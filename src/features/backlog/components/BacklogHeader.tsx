import PageHeader from "@/components/layout/PageHeader";
import CreateBacklogButton from "./CreateBacklogButton";

export default function BacklogHeader() {
  return (
    <PageHeader
      title="Backlog items"
      description="Track and filter backlog items."
      actions={<CreateBacklogButton gradient />}
    />
  );
}
