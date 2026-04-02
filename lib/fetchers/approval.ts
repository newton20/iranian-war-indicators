import { safeFetch } from "./safe-fetch";

export interface ApprovalResult {
  approval: number;
  pollDate: string;
}

const RCP_URL =
  "https://www.realclearpolling.com/polls/approval/donald-trump/approval-rating";

export async function fetchApproval(): Promise<{
  data: ApprovalResult | null;
  error: string | null;
}> {
  return safeFetch<ApprovalResult>(
    RCP_URL,
    async (response) => {
      const html = await response.text();

      // Try multiple regex patterns to find the aggregate approval percentage.
      // RCP pages vary in structure, so we attempt several common patterns.
      const patterns = [
        /Approve\s*[:\s]*(\d{1,2}(?:\.\d+)?)\s*%/i,
        /approval[^>]*>\s*(\d{1,2}(?:\.\d+)?)\s*%/i,
        /class="[^"]*approve[^"]*"[^>]*>\s*(\d{1,2}(?:\.\d+)?)/i,
        /(\d{1,2}(?:\.\d+)?)\s*%\s*<\/(?:span|td|div)[^>]*>\s*(?:<[^>]*>)*\s*(?:Approve|Approval)/i,
        /(?:Approve|Approval)[^<]*<[^>]*>\s*(\d{1,2}(?:\.\d+)?)/i,
      ];

      let approvalValue: number | null = null;

      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          const val = parseFloat(match[1]);
          if (val >= 20 && val <= 70) {
            approvalValue = val;
            break;
          }
        }
      }

      if (approvalValue === null) {
        // Broader fallback: look for a two-digit number near "approve"
        const broad = html.match(
          /[Aa]pprov\w*[^0-9]{0,50}(\d{2}(?:\.\d+)?)/
        );
        if (broad) {
          const val = parseFloat(broad[1]);
          if (val >= 20 && val <= 70) {
            approvalValue = val;
          }
        }
      }

      if (approvalValue === null) {
        throw new Error(
          "Could not extract approval rating from RealClearPolitics page"
        );
      }

      // Try to extract a date near the approval value
      const dateMatch = html.match(
        /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*\d{1,2}\/\d{1,2}\/\d{2,4}/
      );
      const pollDate = dateMatch
        ? dateMatch[0]
        : new Date().toISOString().split("T")[0];

      return { approval: approvalValue, pollDate };
    },
    {
      timeoutMs: 20000,
      validateResult: (d) => d.approval >= 20 && d.approval <= 70,
    }
  );
}
