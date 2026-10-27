export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { issueSignInCode, signInLink } = await import("@/lib/sign-in-code");
  console.log(`local-designer: open ${signInLink(issueSignInCode())}`);
}
