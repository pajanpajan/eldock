// Fáze 71: entity synchronizované do aplikací (docs/SYNC_API.md §4) – jejich rodiče pro místní kaskádu smazání
// a tvar záznamů, jak je server posílá (sloupce modelů Prismy, časy jako řetězce ISO 8601). Čistý modul bez
// frameworku: sdílí ho aplikace pro Windows, mobilní aplikace (fáze 73) i server závodu (fáze 72).

import type {
  AttachmentCategory,
  AttachmentType,
  BuildingType,
  ChangeRequestEventType,
  ChangeRequestPriority,
  ChangeRequestStatus,
  ComplianceCategory,
  ComponentWearCategory,
  DefectSeverity,
  DefectStatus,
  EquipmentStatus,
  EquipmentType,
  InspectionResult,
  InspectionType,
  RevisionStatus,
  SafetyImpactLevel,
  SoftwareBackupStatus,
  TemporaryModStatus,
} from "@/generated/prisma/enums";

/** Rodič entity: [entita rodiče, pole s jeho id]; `null` = kořen (závod, uživatel firmy). */
export const ENTITY_PARENTS = {
  Plant: null,
  Building: ["Plant", "plantId"],
  Floor: ["Building", "buildingId"],
  Equipment: ["Floor", "floorId"],
  ComplianceDocument: ["Equipment", "equipmentId"],
  InspectionRecord: ["Equipment", "equipmentId"],
  InspectionDefect: ["Equipment", "equipmentId"],
  DocumentRevision: ["Equipment", "equipmentId"],
  BomItem: ["DocumentRevision", "revisionId"],
  SchematicReference: ["DocumentRevision", "revisionId"],
  ChangeRequest: ["Equipment", "equipmentId"],
  Attachment: ["ChangeRequest", "changeRequestId"],
  ChangeRequestEvent: ["ChangeRequest", "changeRequestId"],
  TemporaryModification: ["Equipment", "equipmentId"],
  EquipmentDocument: ["Equipment", "equipmentId"],
  SoftwareBackup: ["Equipment", "equipmentId"],
  MonitoredComponent: ["Equipment", "equipmentId"],
  User: null,
} as const satisfies Record<string, readonly [string, string] | null>;

export type EntityName = keyof typeof ENTITY_PARENTS;
export const ENTITY_NAMES = Object.keys(ENTITY_PARENTS) as EntityName[];

export const isEntityName = (value: string): value is EntityName => Object.prototype.hasOwnProperty.call(ENTITY_PARENTS, value);

/** Přímí potomci entity (pro kaskádu smazání). */
export const ENTITY_CHILDREN: Record<EntityName, EntityName[]> = Object.fromEntries(
  ENTITY_NAMES.map((entity) => [entity, ENTITY_NAMES.filter((child) => ENTITY_PARENTS[child]?.[0] === entity)]),
) as Record<EntityName, EntityName[]>;

/** Id rodiče ze záznamu (null u kořenů nebo chybějícího pole). */
export function parentIdOf(entity: EntityName, data: Record<string, unknown>): string | null {
  const parent = ENTITY_PARENTS[entity];
  if (!parent) return null;
  const value = data[parent[1]];
  return typeof value === "string" ? value : null;
}

type Iso = string;

export interface PlantRecord {
  id: string;
  code: string;
  name: string;
  customerName: string;
  address: string | null;
  city: string | null;
  country: string;
  updatedAt: Iso;
}

export interface BuildingRecord {
  id: string;
  plantId: string;
  code: string;
  name: string;
  shortName: string | null;
  type: BuildingType;
  description: string | null;
  color: string | null;
  sortOrder: number;
  updatedAt: Iso;
}

export interface FloorRecord {
  id: string;
  buildingId: string;
  level: number;
  code: string;
  name: string;
  description: string | null;
  floorplanUrl: string | null;
  floorplanSvg: string | null;
  viewBoxW: number;
  viewBoxH: number;
  updatedAt: Iso;
}

export interface EquipmentRecord {
  id: string;
  floorId: string;
  tag: string;
  name: string;
  type: EquipmentType;
  status: EquipmentStatus;
  description: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  yearInstalled: number | null;
  ratedVoltage: string | null;
  ratedCurrent: string | null;
  ipRating: string | null;
  fedFromEquipmentId: string | null;
  fedFromCircuit: string | null;
  inspectionIntervalMonths: number;
  inventoryNumber: string | null;
  assignedZone: string | null;
  protectionClass: string | null;
  photoUrl: string | null;
  qrToken: string | null;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface InspectionRecordRecord {
  id: string;
  equipmentId: string;
  type: InspectionType;
  inspectionDate: Iso;
  validUntil: Iso;
  reportNumber: string;
  inspectorName: string;
  inspectorLicense: string;
  result: InspectionResult;
  defectsSummary: string | null;
  reportUrl: string;
  updatedAt: Iso;
}

export interface InspectionDefectRecord {
  id: string;
  inspectionId: string;
  equipmentId: string;
  description: string;
  provision: string | null;
  severity: DefectSeverity;
  deadline: Iso;
  status: DefectStatus;
  resolvedAt: Iso | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  resolutionPhotoUrl: string | null;
  updatedAt: Iso;
}

export interface TemporaryModificationRecord {
  id: string;
  equipmentId: string;
  number: string;
  title: string;
  description: string;
  createdByName: string;
  createdByRole: string;
  createdAt: Iso;
  expiresAt: Iso;
  photoUrl: string | null;
  status: TemporaryModStatus;
  resolvedAt: Iso | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
  updatedAt: Iso;
}

export interface ChangeRequestRecord {
  id: string;
  number: string;
  equipmentId: string;
  status: ChangeRequestStatus;
  priority: ChangeRequestPriority;
  note: string | null;
  voiceTranscript: string | null;
  reporterId: string;
  assigneeId: string | null;
  engineerSummary: string | null;
  safetyImpact: SafetyImpactLevel;
  requiresSoftwareUpdate: boolean;
  submittedAt: Iso;
  resolvedAt: Iso | null;
  closedAt: Iso | null;
  updatedAt: Iso;
}

export interface ChangeRequestEventRecord {
  id: string;
  changeRequestId: string;
  type: ChangeRequestEventType;
  actorId: string;
  fromStatus: ChangeRequestStatus | null;
  toStatus: ChangeRequestStatus | null;
  comment: string | null;
  createdAt: Iso;
}

export interface AttachmentRecord {
  id: string;
  changeRequestId: string;
  type: AttachmentType;
  url: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  caption: string | null;
  uploadedById: string;
  createdAt: Iso;
}

export interface ComplianceDocumentRecord {
  id: string;
  equipmentId: string;
  category: ComplianceCategory;
  title: string;
  documentNumber: string;
  fileUrl: string;
  issuedAt: Iso;
  issuer: string;
  notes: string | null;
}

export interface DocumentRevisionRecord {
  id: string;
  equipmentId: string;
  version: string;
  status: RevisionStatus;
  title: string;
  summary: string | null;
  schematicUrl: string;
  sheetCount: number;
  bomFileUrl: string | null;
  layoutUrl: string | null;
  approvedAt: Iso | null;
  createdAt: Iso;
  updatedAt: Iso;
}

export interface BomItemRecord {
  id: string;
  revisionId: string;
  position: number;
  designation: string;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  quantity: number;
  unit: string;
  note: string | null;
}

export interface SchematicReferenceRecord {
  id: string;
  revisionId: string;
  page: number;
  designation: string;
  title: string;
  description: string | null;
  linkedEquipmentId: string | null;
}

export interface EquipmentDocumentRecord {
  id: string;
  equipmentId: string;
  category: AttachmentCategory;
  title: string;
  componentTag: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  version: string;
  language: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  createdAt: Iso;
}

export interface SoftwareBackupRecord {
  id: string;
  equipmentId: string;
  targetUnit: string;
  platform: string;
  major: number;
  minor: number;
  status: SoftwareBackupStatus;
  firmwareVersion: string | null;
  isSafetyRelated: boolean;
  changeSummary: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes: number;
  createdAt: Iso;
}

export interface MonitoredComponentRecord {
  id: string;
  equipmentId: string;
  designation: string;
  name: string;
  manufacturer: string | null;
  modelNumber: string | null;
  wearCategory: ComponentWearCategory;
  installedAt: Iso;
  maxCalendarMonths: number | null;
  maxElectricalCycles: number | null;
  maxOperatingHours: number | null;
  replacementStockCount: number;
  notes: string | null;
  updatedAt: Iso;
}

export interface UserRecord {
  id: string;
  name: string;
  role: string;
  accountType: string;
  title: string | null;
  companyId: string | null;
  homePlantId: string | null;
  disabledAt: Iso | null;
}

/** Tvar záznamu podle entity. */
export interface EntityRecords {
  Plant: PlantRecord;
  Building: BuildingRecord;
  Floor: FloorRecord;
  Equipment: EquipmentRecord;
  ComplianceDocument: ComplianceDocumentRecord;
  InspectionRecord: InspectionRecordRecord;
  InspectionDefect: InspectionDefectRecord;
  DocumentRevision: DocumentRevisionRecord;
  BomItem: BomItemRecord;
  SchematicReference: SchematicReferenceRecord;
  ChangeRequest: ChangeRequestRecord;
  Attachment: AttachmentRecord;
  ChangeRequestEvent: ChangeRequestEventRecord;
  TemporaryModification: TemporaryModificationRecord;
  EquipmentDocument: EquipmentDocumentRecord;
  SoftwareBackup: SoftwareBackupRecord;
  MonitoredComponent: MonitoredComponentRecord;
  User: UserRecord;
}
