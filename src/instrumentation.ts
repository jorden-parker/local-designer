export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { accessLink, loadAccessToken } = await import("@/lib/access-token");
  console.log(`local-designer: open ${accessLink(loadAccessToken())}`);
}
