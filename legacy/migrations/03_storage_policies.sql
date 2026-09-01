-- Cognify Production Supabase Storage Buckets (03_storage_policies.sql)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('question-papers', 'question-papers', false, 52428800, ARRAY['application/pdf']),
    ('answer-keys', 'answer-keys', false, 52428800, ARRAY['application/pdf']),
    ('resources', 'resources', true, 104857600, NULL),
    ('excel-imports', 'excel-imports', false, 52428800, ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']),
    ('backups', 'backups', false, 209715200, ARRAY['application/json', 'application/octet-stream', 'application/zip'])
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
