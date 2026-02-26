"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { getProjectId, getProject, setProject } from "./auth";
import type { StoredProject } from "./auth";

/**
 * Hook to get the current project. If the project isn't stored in localStorage
 * yet (e.g. right after login), it fetches from the API and caches it.
 */
export function useProject() {
  const [project, setProjectState] = useState<StoredProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = getProject();
    if (stored) {
      setProjectState(stored);
      setLoading(false);
      return;
    }

    // No project in localStorage -- fetch from API
    let cancelled = false;
    (async () => {
      try {
        const projects = await api.getProjects();
        if (cancelled) return;
        if (projects.length > 0) {
          const proj = projects[0]; // Use first project
          const storedProj: StoredProject = {
            id: proj.id,
            name: proj.name,
            project_token: proj.project_token,
            api_key: proj.api_key,
          };
          setProject(storedProj);
          setProjectState(storedProj);
        } else {
          setError("No projects found. Please create a project first.");
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const apiErr = err as { detail?: string };
        setError(apiErr.detail || "Failed to load project");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { project, projectId: project?.id ?? null, loading, error };
}

/**
 * Generic hook for API data fetching with loading / error states.
 */
export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err: unknown) {
      const apiErr = err as { detail?: string };
      setError(apiErr.detail || "An error occurred");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}
