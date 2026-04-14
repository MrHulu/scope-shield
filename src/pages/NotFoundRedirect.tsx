import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';

export function NotFoundRedirect() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const lastVisitedProjectId = useUIStore((s) => s.lastVisitedProjectId);

  useEffect(() => {
    // Try last visited
    if (lastVisitedProjectId) {
      const exists = projects.find((p) => p.id === lastVisitedProjectId);
      if (exists) {
        navigate(`/project/${lastVisitedProjectId}`, { replace: true });
        return;
      }
    }
    // Fallback to first active or any project
    const fallback = projects.find((p) => p.status === 'active') ?? projects[0];
    if (fallback) {
      navigate(`/project/${fallback.id}`, { replace: true });
    }
    // If no projects at all, demo will be created in App
  }, [projects, lastVisitedProjectId, navigate]);

  return null;
}
