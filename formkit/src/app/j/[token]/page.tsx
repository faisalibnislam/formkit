import { JoinForm } from "@/components/app/JoinForm";

export const metadata = { title: "Join a form — Formkit", robots: { index: false } };

/** An invite link: anyone signed in who opens it joins the form. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <JoinForm token={token} />;
}
