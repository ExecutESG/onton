import pty
import os
import time
import sys
import select

# Credentials
HOST = os.environ.get("PROD_HOST", "65.109.212.86")
PASS = os.environ.get("PROD_PASS")
if not PASS:
    import getpass
    PASS = getpass.getpass(f"Enter root password for {HOST}: ")

def ssh_execute_interactive(host, password, commands):
    print(f"--- CONNECTING TO {host} ---")
    pid, fd = pty.fork()
    if pid == 0:
        # We start a bash shell to run multiple commands within one session
        os.execvp("ssh", ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", f"root@{host}"])
    else:
        output_buffer = b""
        password_sent = False
        commands_sent = False
        start_time = time.time()
        
        # Combine commands into a single script block
        full_script = """
        set -e
        echo "--> STARTING HOT BACKUP"
        
        # 1. Database Dump
        echo "--> Dumping Database..."
        timestamp=$(date +"%Y%m%d_%H%M%S")
        export BACKUP_DIR="/root/migration_backup"
        mkdir -p $BACKUP_DIR
        
        # Find postgres container
        PG_CONTAINER=$(docker ps -q -f name=postgres)
        if [ -z "$PG_CONTAINER" ]; then
            echo "❌ ERROR: Postgres container not found!"
            exit 1
        fi
        
        echo "   Target Container: $PG_CONTAINER"
        docker exec -t $PG_CONTAINER pg_dumpall -c -U ontonont > $BACKUP_DIR/full_db_dump.sql
        echo "   Database dump created: $BACKUP_DIR/full_db_dump.sql"
        
        # 2. Data Archive
        echo "--> Archiving Data Directory..."
        # Assuming project is at /root/ontonbot and data is at /root/ontonbot/data
        if [ ! -d "/root/ontonbot/data" ]; then
             echo "❌ ERROR: /root/ontonbot/data not found!"
             exit 1
        fi
        
        cd /root/ontonbot
        tar -czf $BACKUP_DIR/data_archive.tar.gz data
        echo "   Data archive created: $BACKUP_DIR/data_archive.tar.gz"
        
        # 3. Create Manifest
        echo "Migration Backup" > $BACKUP_DIR/manifest.txt
        date >> $BACKUP_DIR/manifest.txt
        
        # 4. Final Bundle
        echo "--> Bundling into single artifact..."
        cd /root
        tar -czf /root/migration_bundle_$timestamp.tar.gz -C $BACKUP_DIR .
        
        echo "✅ SUCCESS: Backup Bundle Ready at /root/migration_bundle_$timestamp.tar.gz"
        ls -lh /root/migration_bundle_$timestamp.tar.gz
        
        # Cleanup temp dir (optional, keeping bundle)
        rm -rf $BACKUP_DIR
        
        echo "--> DONE"
        exit
        """
        
        while True:
            # Check for timeout (300s = 5 mins for backup)
            if time.time() - start_time > 300:
                print("TIMEOUT: Operation took too long.")
                break
                
            r, w, e = select.select([fd], [], [], 1.0)
            if fd in r:
                try:
                    chunk = os.read(fd, 1024)
                    if not chunk:
                        break
                    output_buffer += chunk
                    
                    # Debug print to see what's happening
                    sys.stdout.write(chunk.decode('utf-8', errors='ignore'))
                    sys.stdout.flush()

                    # Handle Password
                    if (b"password:" in chunk.lower() or b"passphrase" in chunk.lower()) and not password_sent:
                        os.write(fd, (password + "\n").encode())
                        password_sent = True
                    
                    # Send Commands once logged in
                    # We detect login by prompt (usually '#' for root)
                    if password_sent and not commands_sent and (b"#" in chunk or b"root@" in chunk):
                        time.sleep(1) # Wait a beat for shell to settle
                        os.write(fd, full_script.encode())
                        commands_sent = True
                        
                except OSError:
                    break
        
        _, status = os.waitpid(pid, 0)
        return

ssh_execute_interactive(HOST, PASS, "")
