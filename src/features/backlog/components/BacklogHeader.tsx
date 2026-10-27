import PageHeader from "@/components/layout/PageHeader";
import CreateBacklogButton from "./CreateBacklogButton";

export default function BacklogHeader() {
  return (
    <PageHeader
      title="All items"
      description="Track, filter and prioritise every backlog item across sprints."
      actions={
        <div className="w-full sm:w-auto">
          <CreateBacklogButton gradient />
        </div>
      }
    />
  );
}
