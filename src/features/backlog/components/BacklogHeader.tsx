import PageHeader from "@/components/layout/PageHeader";
import CreateBacklogButton from "./CreateBacklogButton";

export default function BacklogHeader() {
  return (
    <PageHeader
      title="All items"
      description="Track and filter backlog items."
      actions={
        <div className="w-full sm:w-auto">
          <CreateBacklogButton gradient />
        </div>
      }
    />
  );
}
