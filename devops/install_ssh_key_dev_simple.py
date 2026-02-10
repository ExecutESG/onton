import pty
import os
import time
import sys

# Credentials
HOST = "65.109.205.239"
PASS = "M4XjHXnrg4Xm"
PUB_KEY = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDezu5Ie1zr/3OD2moFUFAqbg5zZnjcz4cnHuCBczR7ELVsc1nbvBrTeN7QmeYWb6TbHLl+O6Zdapcfd6KWwUyESILmA3gG6VTKS/TAqttO0RezW4jUn/27SJ/cljH7+T7upErDOWRshO8yjOhRX5SQNEHcBrKf+V1hlAFSWhBGlSpQyXZb8/pqGumro7iEbFlJ9scKMCUDujrVpOAW43cffgtW5voMX1gtLLMgZOJgpsPCj066uxu9dfrD1dNv7lTtOlTZ0kXat//updcbW+55SmlnhiXzIU4TysSn4sk2kaW21U8m8rjDUDULQjMnM6OlKNIoPh8s1kEIAYUhgs0ZgWTs5tjc+P3vD+6RTVU5DLh8a6wRwo+8oROTZuhpo18UXB40qyEozYylUECLAhTqcZr6a0mzonrP8w1fY8+s+QDI+1UxBsyWDCUCrvWbUOLWxxlC4uliIoCcMdoEILuWkeDKRK0jFPbVHtpYLoJoWON+5Dzarh/WroP7RO3vCE/f5C0eNgUKGcahfWRfBieSEH+3ZR3qmj//SksziciW/SVV6PH30EFRyfzoP+hlfIWNjdpSg1Cm6ow/Sstme0s+KYpvucmZ0OV+ZiFhQS2//6gPcg0V0xzc8XCBRgdVXgHJmqov1wr288LAlBDd8TlgheC3PYIjr+v0GJGxobS6ow== mahdifarimani@Mac.home"

CMDS = f"""
export TERM=xterm
mkdir -p /root/.ssh
echo "{PUB_KEY}" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
echo "KEY_INSTALLED_SUCCESS"
exit
"""

print(f"--- BLIND INSTALL TO {HOST} ---")
pid, fd = pty.fork()
if pid == 0:
    os.execvp("ssh", ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null", f"root@{HOST}"])
else:
    # Read initial output
    time.sleep(2)
    os.read(fd, 1024) 
    
    # Send Password blindly
    os.write(fd, (PASS + "\n").encode())
    
    # Wait for login
    time.sleep(3)
    
    # Send Commands blindly
    os.write(fd, CMDS.encode())
    
    # Read result
    time.sleep(2)
    output = os.read(fd, 4096).decode('utf-8', errors='ignore')
    print(output)
    
    os.waitpid(pid, 0)
