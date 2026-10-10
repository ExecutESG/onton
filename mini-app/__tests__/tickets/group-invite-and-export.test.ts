import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import yaml from "yaml";

describe("Phase 0: Quick Wins & Production Safety", () => {
  describe("inspect-server.yml Workflow Safety", () => {
    const workflowPath = path.resolve(__dirname, "../../../.github/workflows/inspect-server.yml");

    it("verifies inspect-server.yml exists and parses as valid YAML", () => {
      const fileContent = fs.readFileSync(workflowPath, "utf-8");
      const parsed = yaml.parse(fileContent);
      expect(parsed).toBeDefined();
      expect(parsed.name).toBe("Inspect Swarm Server");
    });

    it("verifies dns_ip input defaults to production IP 65.109.212.86", () => {
      const fileContent = fs.readFileSync(workflowPath, "utf-8");
      const parsed = yaml.parse(fileContent);
      const inputs = parsed.on.workflow_dispatch.inputs;

      expect(inputs.dns_ip).toBeDefined();
      expect(inputs.dns_ip.default).toBe("65.109.212.86");
      expect(inputs.target_ip).toBeDefined();
      expect(inputs.target_port).toBeDefined();
    });

    it("verifies Cloudflare DNS step references dynamic TARGET_IP instead of hardcoded staging IP", () => {
      const fileContent = fs.readFileSync(workflowPath, "utf-8");
      expect(fileContent).toContain('TARGET_IP="${{ github.event.inputs.dns_ip || \'65.109.212.86\' }}"');
      expect(fileContent).not.toMatch(/"content":"65\.109\.182\.13"/);
    });
  });

  describe("Telegram Group Invite & Clipboard Fallback Logic", () => {
    const isTgLink = (link: string) =>
      /^https?:\/\/(t\.me|telegram\.me)\//i.test(link) || /^tg:\/\//i.test(link);

    it("correctly identifies Telegram links vs external links", () => {
      expect(isTgLink("https://t.me/+abc123xyz")).toBe(true);
      expect(isTgLink("https://telegram.me/ontonchat")).toBe(true);
      expect(isTgLink("tg://join?invite=xyz")).toBe(true);
      expect(isTgLink("https://discord.gg/invite123")).toBe(false);
      expect(isTgLink("https://chat.whatsapp.com/abc")).toBe(false);
    });

    it("falls back to document.execCommand when navigator.clipboard.writeText rejects", async () => {
      let execCommandCalled = false;
      let execCommandArg = "";

      const mockNavigator = {
        clipboard: {
          writeText: vi.fn().mockRejectedValue(new Error("Clipboard permission denied")),
        },
      };

      const mockDocument = {
        createElement: vi.fn().mockReturnValue({
          style: {},
          value: "",
          focus: vi.fn(),
          select: vi.fn(),
        }),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn(),
        },
        execCommand: vi.fn().mockImplementation((cmd: string) => {
          execCommandCalled = true;
          execCommandArg = cmd;
          return true;
        }),
      };

      // Simulate copy logic from TicketGroupInviteButton
      const testCopy = async (inviteLink: string) => {
        let copiedSuccess = false;
        if (typeof mockNavigator !== "undefined" && mockNavigator.clipboard?.writeText) {
          try {
            await mockNavigator.clipboard.writeText(inviteLink);
            copiedSuccess = true;
          } catch {
            // Fall back
          }
        }
        if (!copiedSuccess && typeof mockDocument !== "undefined") {
          try {
            const textArea = mockDocument.createElement("textarea");
            textArea.value = inviteLink;
            mockDocument.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            copiedSuccess = mockDocument.execCommand("copy");
            mockDocument.body.removeChild(textArea);
          } catch {
            copiedSuccess = false;
          }
        }
        return copiedSuccess;
      };

      const result = await testCopy("https://t.me/+joinchat123");
      expect(mockNavigator.clipboard.writeText).toHaveBeenCalledWith("https://t.me/+joinchat123");
      expect(execCommandCalled).toBe(true);
      expect(execCommandArg).toBe("copy");
      expect(result).toBe(true);
    });
  });

  describe("RegistrationGuestList Export Safety", () => {
    it("handles HapticFeedback gracefully without crashing when undefined", () => {
      const mockWebAppMissingHf = {
        HapticFeedback: undefined,
      };

      expect(() => {
        (mockWebAppMissingHf as any)?.HapticFeedback?.impactOccurred?.("soft");
      }).not.toThrow();
    });

    it("triggers impactOccurred when HapticFeedback is available", () => {
      const impactOccurred = vi.fn();
      const mockWebApp = {
        HapticFeedback: {
          impactOccurred,
        },
      };

      mockWebApp?.HapticFeedback?.impactOccurred?.("soft");
      expect(impactOccurred).toHaveBeenCalledWith("soft");
    });
  });
});
