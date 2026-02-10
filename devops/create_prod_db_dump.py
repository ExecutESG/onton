import pty
import os
import time
import sys
import select

HOST = "65.109.212.86"
PASS = "89*evddQFpZXHA7BCnmV"

CMDS = """
export TERM=xterm
echo "--> STARTING DB DUMP"
PG_CONTAINER=$(docker ps -q -f name=postgres | head -n 1)
if [ -n "$PG_CONTAINER" ]; then
    echo "Found Postgres Container: $PG_CONTAINER"
    # Dump and gzip directly to save space
    docker exec -e PGPASSWORD=@GqjCiFjdywo2hliunXyeLBD $PG_CONTAINER pg_dumpall -c -U onton | gzip > /root/prod_db_dump_$(date +%Y%m%d).sql.gz
    echo "✅ DUMP COMPLETE: /root/prod_db_dump_$(date +%Y%m%d).sql.gz"
    ls -lh /root/prod_db_dump_$(date +%Y%m%d).sql.gz
else
    echo "❌ ERROR: Postgres container not found"
fi
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
        if time.time() - start > 120:
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
                
                if (b"password:" in buff or b"passphrase" in buff) and not password_sent:
                    os.write(fd, (PASS + "\n").encode())
                    password_sent = True
                    buff = b""
                
                if password_sent and not cmds_sent and (b"#" in buff or b"~" in buff):
                    time.sleep(1)
                    os.write(fd, CMDS.encode())
                    cmds_sent = True
                    
            except OSError:
                break
    
    os.waitpid(pid, 0)
