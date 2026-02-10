import pty
import os
import time
import sys
import select

HOST = "65.109.212.86"
PASS = "89*evddQFpZXHA7BCnmV"

CMDS = """
export TERM=xterm
echo "--> DIAGNOSING V2"
PG_CONTAINER=$(docker ps -q -f name=postgres)

# Set full path to avoid path issues
DUMP_FILE="/root/raw_dump.sql"
LOG_FILE="/root/dump.log"

echo "--> Dumping to $DUMP_FILE (No Gzip)"
# Use -v (verbose) to see what happens
docker exec -e PGPASSWORD=@GqjCiFjdywo2hliunXyeLBD $PG_CONTAINER pg_dumpall -c -U onton -v > $DUMP_FILE 2> $LOG_FILE

echo "--> Check File Size:"
ls -lh $DUMP_FILE

echo "--> Check Log Start:"
head -n 20 $LOG_FILE
echo "..."
echo "--> Check Log End:"
tail -n 20 $LOG_FILE

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
