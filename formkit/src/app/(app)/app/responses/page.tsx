import { Suspense } from "react";
import { ResponsesInbox } from "@/components/app/ResponsesInbox";

export const metadata = { title: "Responses" };

export default function ResponsesPage() {
  return (
    <Suspense fallback={null}>
      <ResponsesInbox />
    </Suspense>
  );
}
