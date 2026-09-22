import { Suspense } from "react";
import { FormEditor } from "@/components/app/FormEditor";
import type { Id } from "../../../../../convex/_generated/dataModel";

export default async function FormEditorPage({ params }: PageProps<"/app/forms/[id]">) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <FormEditor formId={id as Id<"forms">} />
    </Suspense>
  );
}
