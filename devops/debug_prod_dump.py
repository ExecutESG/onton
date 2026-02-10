import pty
import os
import time
import sys
import select

HOST = "65.109.212.86"
PASS = "89*evddQFpZXHA7BCnmV"

CMDS = """
export TERM=xterm
echo "--> DIAGNOSING EMPTY DUMP"
PG_CONTAINER=$(docker ps -q -f name=postgres)

# 1. Check if user 'ontonont' exists and has permissions
echo "--> Checking DB User List:"
docker exec $PG_CONTAINER psql -U ontonont -d postgres -c "\\du" || echo "FAIL: User check failed"

# 2. Try dumping WITHOUT -t (tty) and redirecting stderr
echo "--> Retrying Dump (Simple):"
# Removing -t to avoid TTY control chars in the stream
docker exec $PG_CONTAINER pg_dumpall -c -U ontonont 2> /root/dump_error.log | gzip > /root/debug_dump.sql.gz

echo "--> Check File Size:"
ls -lh /root/debug_dump.sql.gz
echo "--> Check stderr log (if any):"
cat /root/dump_error.log

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
        if time.time() - start > 60:
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
