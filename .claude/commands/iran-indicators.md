Fetch the latest Iranian war indicator data and display a concise terminal dashboard.

Steps:

1. Make a GET request to the report API. Try the deployed Vercel URL first (check `vercel inspect` or `.vercel/project.json` for the production domain). Fall back to `http://localhost:3000/api/report` for local development.

2. Parse the JSON response. If `status` is `"empty"`, print "No indicator data available yet." and stop.

3. Format the output exactly like this (substitute real values):

```
Risk Level: {data.risk_badge}
Hormuz: {data.hormuz_status} ({data.hormuz_transits} transits, as of {data.date})
TACO Stress: {data.taco_score}/10 (approval {data.approval_rating}%, S&P {data.sp500_30d_return}%, inflation {data.inflation_1y}%, T-bill {data.tbill_3m}%)
{each alert on its own line, if any}
Oil: Brent ${data.oil_price_brent}
Data quality: {data.taco_components_available}/4 components {data.data_quality}
```

- For any null values, show "N/A" in place of the number.
- If there are no alerts, omit that section entirely (no blank line).
- Print the output as plain text directly to the terminal — do not wrap it in a code block.
