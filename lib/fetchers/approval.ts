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

      // The RCP page uses Next.js RSC streaming (self.__next_f.push calls).
      // The approval data is embedded as escaped JSON in the streamed payload.
      // We try multiple patterns in order of specificity.
      const patterns = [
        // Pattern 1: RSC JSON payload with escaped quotes (most reliable)
        // Matches: \"name\":\"Approve\",\"affiliation\":\"...\",\"value\":\"41.1\"
        /\\"name\\":\\"Approve\\",\\"affiliation\\":\\"[^"]*\\",\\"value\\":\\"(\d{1,2}(?:\.\d+)?)\\"/,
        // Pattern 2: Same structure but with regular quotes (if unescaped)
        /"name":"Approve","affiliation":"[^"]*","value":"(\d{1,2}(?:\.\d+)?)"/,
        // Pattern 3: Rendered text "Approve 41.1%"
        /Approve\s+(\d{1,2}(?:\.\d+)?)\s*%/,
        // Pattern 4: Generic approve near a number
        /[Aa]pprov\w*[^0-9]{0,80}(\d{1,2}(?:\.\d+)?)\s*%/,
        // Pattern 5: Number near approve (reversed order)
        /(\d{1,2}(?:\.\d+)?)\s*%[^A-Za-z]{0,40}[Aa]pprov/,
      ];

      let approvalValue: number | null = null;
      let matchedPatternIndex: number | null = null;

      for (let i = 0; i < patterns.length; i++) {
        const match = html.match(patterns[i]);
        if (match) {
          const val = parseFloat(match[1]);
          if (isNaN(val)) {
            console.error(
              `Approval parse: pattern ${i + 1} matched but parseFloat returned NaN. Raw match: "${match[1]}"`
            );
            continue;
          }
          if (val < 20 || val > 70) {
            console.error(
              `Approval parse: pattern ${i + 1} matched but value ${val} is outside valid range [20, 70]`
            );
            continue;
          }
          approvalValue = val;
          matchedPatternIndex = i + 1;
          break;
        }
      }

      if (approvalValue === null || matchedPatternIndex === null) {
        console.error(
          "Approval parse error: no pattern produced a valid approval value. RCP HTML may have changed format."
        );
        throw new Error(
          "Could not extract approval rating from RealClearPolitics page"
        );
      }

      console.log(
        `Approval: ${approvalValue}% (matched pattern ${matchedPatternIndex})`
      );

      // Try to extract the polling date range.
      // RCP uses formats like "3/12 - 3/31" (no year) or "3/12/2026 - 3/31/2026"
      const dateMatch =
        html.match(
          /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/
        ) ||
        html.match(
          /(\d{1,2}\/\d{1,2})\s*-\s*(\d{1,2}\/\d{1,2})/
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
