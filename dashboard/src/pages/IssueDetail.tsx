import { useParams } from "react-router-dom";

import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { useIssue } from "@/hooks/useIssues";

export function IssueDetail() {
  const params = useParams<{ id: string }>();
  const issueQuery = useIssue(params.id);

  if (issueQuery.isLoading) {
    return <p className="text-slate-600">Issue Detail - Loading...</p>;
  }

  if (issueQuery.isError || !issueQuery.data) {
    return <p className="text-red-700">Issue Detail - Unable to load issue.</p>;
  }

  const issue = issueQuery.data.issue;

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Issue Detail</h2>
        <p className="text-sm text-slate-600">Timeline and metadata for a single issue.</p>
      </header>

      <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-xl font-semibold text-slate-900">{issue.title}</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill status={issue.status} />
          <SeverityBadge severity={issue.severity} />
        </div>
        <p className="mt-3 text-sm text-slate-700">Updates: {issueQuery.data.updates.length}</p>
        <p className="text-sm text-slate-700">Related issues: {issueQuery.data.related_issues.length}</p>
      </article>
    </section>
  );
}
