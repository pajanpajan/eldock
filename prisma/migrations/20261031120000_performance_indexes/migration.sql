-- CreateIndex
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");

-- CreateIndex
CREATE INDEX "ChangeRequest_reporterId_idx" ON "ChangeRequest"("reporterId");

-- CreateIndex
CREATE INDEX "ChangeRequest_baseRevisionId_idx" ON "ChangeRequest"("baseRevisionId");

-- CreateIndex
CREATE INDEX "ChangeRequest_submittedAt_idx" ON "ChangeRequest"("submittedAt");

-- CreateIndex
CREATE INDEX "ChangeRequestEvent_actorId_idx" ON "ChangeRequestEvent"("actorId");

-- CreateIndex
CREATE INDEX "ChangeRequestEvent_revisionId_idx" ON "ChangeRequestEvent"("revisionId");

-- CreateIndex
CREATE INDEX "DocumentRevision_authorId_idx" ON "DocumentRevision"("authorId");

-- CreateIndex
CREATE INDEX "DocumentRevision_approverId_idx" ON "DocumentRevision"("approverId");

-- CreateIndex
CREATE INDEX "Equipment_type_idx" ON "Equipment"("type");

-- CreateIndex
CREATE INDEX "InspectionDefect_status_deadline_idx" ON "InspectionDefect"("status", "deadline");

-- CreateIndex
CREATE INDEX "InspectionRecord_equipmentId_type_validUntil_idx" ON "InspectionRecord"("equipmentId", "type", "validUntil");

-- CreateIndex
CREATE INDEX "NotificationLog_kind_plantId_createdAt_idx" ON "NotificationLog"("kind", "plantId", "createdAt");

-- CreateIndex
CREATE INDEX "TemporaryModification_spawnedChangeRequestId_idx" ON "TemporaryModification"("spawnedChangeRequestId");

-- CreateIndex
CREATE INDEX "User_accountType_idx" ON "User"("accountType");

