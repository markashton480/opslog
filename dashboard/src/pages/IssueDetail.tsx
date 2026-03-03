import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PrincipalAvatar } from "@/components/PrincipalAvatar";
import { SeverityBadge } from "@/components/SeverityBadge";
import { StatusPill } from "@/components/StatusPill";
import { TimelineEntry, type TimelineItem } from "@/components/TimelineEntry";
import { formatRelativeTime } from "@/utils/format";
import { useIssue } from "@/hooks/useIssues";
import { useEvents } from "@/hooks/useEvents";
import { api, ApiError } from "@/api/client";
import type { IssueStatus, Severity } from "@/api/types";

const statusOptions: IssueStatus[] = ["open", "investigating", "watching", "resolved", "wontfix"];
const severityOptions: Severity[] = ["critical", "high", "medium", "low"];

export function IssueDetail() {
  const params = useParams<{ id: string }>();
  const issueId = params.id ?? "";
  const queryClient = useQueryClient();

  const issueQuery = useIssue(issueId, { refetchInterval: 30_000 });
  const eventsQuery = useEvents({ issue_id: issueId, limit: 50 }, { refetchInterval: 30_000 });

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    status: "" as IssueStatus | "",
    severity: "" as Severity | "",
    symptoms: "",
    root_cause: "",
    solution: "",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Add observation state
  const [observation, setObservation] = useState("");
  const [addingObs, setAddingObs] = useState(false);
  const [obsError, setObsError] = useState<string | null>(null);

  // Metadata panel collapse
  const [metadataOpen, setMetadataOpen] = useState(false);

  const startEditing = useCallback(() => {
    if (!issueQuery.data) return;
    const issue = issueQuery.data.issue;
    setEditFields({
      status: issue.status,
      severity: issue.severity,
      symptoms: issue.symptoms ?? "",
      root_cause: issue.root_cause ?? "",
      solution: issue.solution ?? "",
    });
    setEditError(null);
    setEditing(true);
  }, [issueQuery.data]);

  const cancelEditing = () => { setEditing(false); setEditError(null); };

  const submitEdit = async () => {
    if (!issueQuery.data) return;
    const issue = issueQuery.data.issue;
    setSaving(true);
    setEditError(null);

    const patch: Record<string, unknown> = { version: issue.version };
    if (editFields.status && editFields.status !== issue.status) patch.status = editFields.status;
    if (editFields.severity && editFields.severity !== issue.severity) patch.severity = editFields.severity;
    if (editFields.symptoms !== (issue.symptoms ?? "")) patch.symptoms = editFields.symptoms || null;
    if (editFields.root_cause !== (issue.root_cause ?? "")) patch.root_cause = editFields.root_cause || null;
    if (editFields.solution !== (issue.solution ?? "")) patch.solution = editFields.solution || null;

    // If nothing changed, just close
    if (Object.keys(patch).length <= 1) {
      setEditing(false);
      setSaving(false);
      return;
    }

    try {
      await api.issues.update(issueId, patch);
      await queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setEditError("Conflict: this issue was updated by someone else. Please review the latest version and try again.");
        await queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
      } else {
        setEditError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      setSaving(false);
    }
  };

  const submitObservation = async () => {
    if (!observation.trim()) return;
    setAddingObs(true);
    setObsError(null);
    try {
      await api.issues.addUpdate(issueId, {
        content: observation.trim(),
        occurred_at: new Date().toISOString(),
      });
      setObservation("");
      await queryClient.invalidateQueries({ queryKey: ["issue", issueId] });
    } catch (err) {
      setObsError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAddingObs(false);
    }
  };

  // Build timeline
  const timeline = useMemo<TimelineItem[]>(() => {
    if (!issueQuery.data) return [];
    const items: TimelineItem[] = [];
    for (const u of issueQuery.data.updates) {
      items.push({ kind: "update", data: u });
    }
    for (const e of eventsQuery.events) {
      items.push({ kind: "event", data: e });
    }
    items.sort((a, b) => {
      const tA = a.data.occurred_at;
      const tB = b.data.occurred_at;
      return new Date(tA).getTime() - new Date(tB).getTime();
    });
    return items;
  }, [issueQuery.data, eventsQuery.events]);

  /* ── Loading / error states ──────────────────────────── */

  if (issueQuery.isLoading) {
    return (
      <section className="space-y-4 animate-pulse" data-testid="detail-loading">
        <div className="h-8 w-64 rounded bg-slate-200" />
        <div className="h-5 w-96 rounded bg-slate-100" />
        <div className="h-40 rounded-xl bg-slate-100" />
      </section>
    );
  }

  if (issueQuery.isError || !issueQuery.data) {
    return (
      <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-medium text-red-700">Unable to load issue "{issueId}".</p>
        <Link to="/issues" className="mt-2 inline-block text-sm text-slate-600 underline hover:text-slate-900">
          ← Back to Issues Board
        </Link>
      </section>
    );
  }

  const { issue, related_issues } = issueQuery.data;

  return (
    <section className="space-y-6">
      {/* ── Header ──────────────────────────────────────── */}
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{issue.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusPill status={issue.status} />
              <SeverityBadge severity={issue.severity} />
              {issue.server_name && (
                <Link
                  to={`/servers/${issue.server_name}`}
                  className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition"
                >
                  {issue.server_name}
                </Link>
              )}
            </div>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              data-testid="edit-button"
            >
              Edit
            </button>
          )}
        </div>

        {/* Metadata row */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>Created by <PrincipalAvatar principal={issue.created_by} compact /></span>
          <span title={new Date(issue.first_seen).toLocaleString()}>First seen: {formatRelativeTime(issue.first_seen)}</span>
          <span title={new Date(issue.last_occurrence).toLocaleString()}>Last: {formatRelativeTime(issue.last_occurrence)}</span>
          {issue.resolved_at && (
            <span title={new Date(issue.resolved_at).toLocaleString()}>Resolved: {formatRelativeTime(issue.resolved_at)}</span>
          )}
          <span className="font-mono text-slate-400">v{issue.version}</span>
        </div>

        {/* Tags */}
        {issue.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {issue.tags.map((tag) => (
              <span key={tag} className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{tag}</span>
            ))}
          </div>
        )}
      </header>

      {/* ── Edit form ───────────────────────────────────── */}
      {editing && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-5 shadow-sm" data-testid="edit-form">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Edit Issue</h3>
          {editError && (
            <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="edit-error">
              {editError}
            </div>
          )}
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-status" className="mb-1 block text-xs font-medium text-slate-600">Status</label>
              <select
                id="edit-status"
                value={editFields.status}
                onChange={(e) => setEditFields({ ...editFields, status: e.target.value as IssueStatus })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                data-testid="edit-status"
              >
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="edit-severity" className="mb-1 block text-xs font-medium text-slate-600">Severity</label>
              <select
                id="edit-severity"
                value={editFields.severity}
                onChange={(e) => setEditFields({ ...editFields, severity: e.target.value as Severity })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                data-testid="edit-severity"
              >
                {severityOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-symptoms" className="mb-1 block text-xs font-medium text-slate-600">Symptoms</label>
              <textarea
                id="edit-symptoms"
                value={editFields.symptoms}
                onChange={(e) => setEditFields({ ...editFields, symptoms: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-root-cause" className="mb-1 block text-xs font-medium text-slate-600">Root Cause</label>
              <textarea
                id="edit-root-cause"
                value={editFields.root_cause}
                onChange={(e) => setEditFields({ ...editFields, root_cause: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-solution" className="mb-1 block text-xs font-medium text-slate-600">Solution</label>
              <textarea
                id="edit-solution"
                value={editFields.solution}
                onChange={(e) => setEditFields({ ...editFields, solution: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={submitEdit}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              data-testid="edit-save"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Two-column layout ───────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        {/* Left: Timeline */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-900">Timeline</h3>

          {timeline.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
              No updates or linked events yet.
            </p>
          ) : (
            <div className="space-y-2" data-testid="timeline">
              {timeline.map((item) => (
                <TimelineEntry
                  key={item.kind === "update" ? `u-${item.data.id}` : `e-${item.data.id}`}
                  item={item}
                />
              ))}
            </div>
          )}

          {/* Add observation */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="add-observation">
            <h4 className="text-sm font-semibold text-slate-700">Add Observation</h4>
            {obsError && <p className="mt-1 text-xs text-red-600">{obsError}</p>}
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Describe what you observed…"
              rows={3}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              data-testid="observation-input"
            />
            <button
              type="button"
              onClick={submitObservation}
              disabled={addingObs || !observation.trim()}
              className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              data-testid="observation-submit"
            >
              {addingObs ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>

        {/* Right: Metadata panel */}
        <div className="space-y-4">
          <MetadataSection label="Symptoms" content={issue.symptoms} placeholder="No symptoms recorded" />
          <MetadataSection label="Root Cause" content={issue.root_cause} placeholder="Unknown" />
          <MetadataSection label="Solution" content={issue.solution} placeholder="Not yet resolved" />

          {/* Related issues */}
          {related_issues.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-slate-700">Related Issues</h4>
              <ul className="mt-2 space-y-1">
                {related_issues.map((ri) => (
                  <li key={ri.related_issue_id} className="flex items-center gap-2 text-sm">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 uppercase">
                      {ri.relationship.replace(/_/g, " ")}
                    </span>
                    <Link to={`/issues/${ri.related_issue_id}`} className="text-indigo-600 hover:underline truncate">
                      {ri.issue.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Linked events count */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-slate-700">Linked Events</h4>
            <p className="mt-1 text-2xl font-bold text-slate-900">{eventsQuery.events.length}</p>
          </div>

          {/* Metadata JSON */}
          {Object.keys(issue.metadata).length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setMetadataOpen(!metadataOpen)}
                className="flex w-full items-center justify-between text-sm font-semibold text-slate-700"
              >
                Metadata
                <span className="text-xs text-slate-400">{metadataOpen ? "▾" : "▸"}</span>
              </button>
              {metadataOpen && (
                <pre className="mt-2 overflow-x-auto rounded-md bg-slate-800 p-3 text-xs text-slate-200">
                  {JSON.stringify(issue.metadata, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Metadata section helper ─────────────────────────── */

function MetadataSection({ label, content, placeholder }: { label: string; content: string | null; placeholder: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
      {content ? (
        <div className="prose prose-sm prose-slate mt-1 max-w-none">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      ) : (
        <p className="mt-1 text-sm italic text-slate-400">{placeholder}</p>
      )}
    </div>
  );
}
