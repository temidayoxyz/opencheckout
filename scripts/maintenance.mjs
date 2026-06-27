const baseUrl =
  process.env.MAINTENANCE_BASE_URL ??
  `http://127.0.0.1:${process.env.PORT ?? "3080"}`;
const secret = process.env.MAINTENANCE_SECRET;

if (!secret) {
  console.error("MAINTENANCE_SECRET is required");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/maintenance`, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const body = await response.text();
if (!response.ok) {
  console.error(`Maintenance failed (${response.status}): ${body}`);
  process.exit(1);
}

console.log(body);
