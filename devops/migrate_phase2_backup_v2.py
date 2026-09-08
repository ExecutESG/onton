import pty
import os
import time
import sys
import select

HOST = "65.109.212.86"
PASS = "89*evddQFpZXHA7BCnmV"

# Simplified command block (just check access first, then run backup)
CMDS = """
export TERM=xterm
echo "Logged in successfully"
whoami
hostname
echo "--> STARTING BACKUP"
mkdir -p /root/migration_backup
PG_CONTAINER=$(docker ps -q -f name=postgres)
echo "Container: $PG_CONTAINER"
if [ -n "$PG_CONTAINER" ]; then
  docker exec -t $PG_CONTAINER pg_dumpall -c -U ontonont > /root/migration_backup/full_db_dump.sql
  echo "Dump Complete"
else
  echo "No Postgres Container"
fi
echo "Archiving Data..."
cd /root/ontonbot
tar -czf /root/migration_backup/data_archive.tar.gz data
echo "Archive Complete"
timestamp=$(date +"%Y%m%d_%H%M%S")
cd /root
tar -czf /root/migration_bundle_$timestamp.tar.gz -C /root/migration_backup .
echo "BUNDLE: migration_bundle_$timestamp.tar.gz"
echo "DONE"
exit
"""

print(f"--- CONNECTING TO {HOST} ---")
pid, fd = pty.fork()
if pid == 0:
    os.execvp("ssh", ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", f"root@{HOST}"])
else:
    password_sent = False
    cmds_sent = False
    buff = b""
    start = time.time()
    
    while True:
        if time.time() - start > 600:
             print("TIMEOUT")
             break
             
        r, w, e = select.select([fd], [], [], 1.0)
        if fd in r:
            try:
                data = os.read(fd, 1024)
                if not data: break
                buff += data
                sys.stdout.write(data.decode('utf-8', errors='ignore'))
                sys.stdout.flush()
                
                if b"password:" in buff and not password_sent:
                    os.write(fd, (PASS + "\n").encode())
                    password_sent = True
                    buff = b"" # Reset buffer to look for prompt cleanly
                
                # Look for prompt # or $
                if password_sent and not cmds_sent and (b"#" in buff or b"~" in buff):
                    time.sleep(1)
                    os.write(fd, CMDS.encode())
                    cmds_sent = True
                    
            except OSError:
                break
    
    os.waitpid(pid, 0)
