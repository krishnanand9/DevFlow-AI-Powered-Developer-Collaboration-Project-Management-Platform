import { Project } from '../models/Project';
import { Task } from '../models/Task';
import { Role, WorkspaceMember } from '../models/Workspace';
import { forbidden, notFound } from '../utils/httpError';

export const canWrite = (r: Role) => r !== 'viewer';
export const canManage = (r: Role) => r === 'admin' || r === 'project_manager';

export async function workspaceRole(userId: string, workspaceId: string): Promise<Role> {
  const m = await WorkspaceMember.findOne({ workspace: workspaceId, user: userId });
  if (!m) throw forbidden('Not a member of this workspace');
  return m.role as Role;
}

export async function projectAccess(userId: string, projectId: string) {
  const project = await Project.findById(projectId);
  if (!project) throw notFound('Project');
  const role = await workspaceRole(userId, String(project.workspace));
  return { project, role };
}

export async function taskAccess(userId: string, taskId: string) {
  const task = await Task.findById(taskId);
  if (!task) throw notFound('Task');
  const { project, role } = await projectAccess(userId, String(task.project));
  return { task, project, role };
}
