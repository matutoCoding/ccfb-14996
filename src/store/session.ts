import { reactive } from 'vue'
import type { LayoutTiles, LayoutVersion, Material, MatchWarning, ProjectMeta } from '@/core/types'
import { materialRepo, projectRepo, versionRepo } from '@/core/db'

// 全局会话态：当前项目 / 材料 / 最新排块，跨页面共享
interface SessionState {
  projects: ProjectMeta[]
  materials: Material[]
  currentProject: ProjectMeta | null
  currentTiles: LayoutTiles | null
  currentWarnings: MatchWarning[]
  versions: LayoutVersion[]
  loaded: boolean
}

export const session = reactive<SessionState>({
  projects: [],
  materials: [],
  currentProject: null,
  currentTiles: null,
  currentWarnings: [],
  versions: [],
  loaded: false,
})

export async function refreshProjects(): Promise<void> {
  session.projects = await projectRepo.list()
  session.projects.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function refreshMaterials(): Promise<void> {
  session.materials = await materialRepo.list()
  session.materials.sort((a, b) => a.id.localeCompare(b.id))
}

export async function selectProject(id: string): Promise<void> {
  const project = await projectRepo.get(id)
  session.currentProject = project ?? null
  session.currentTiles = null
  session.currentWarnings = []
  session.versions = await versionRepo.listByProject(id)
  session.versions.sort((a, b) => b.createdAt - a.createdAt)
  const current = session.versions.find((v) => v.id === project?.currentVersionId) ?? session.versions[0]
  if (current) {
    session.currentTiles = current.tiles
    session.currentProject!.currentVersionId = current.id
  }
}

export function clearProject(): void {
  session.currentProject = null
  session.currentTiles = null
  session.currentWarnings = []
  session.versions = []
}
