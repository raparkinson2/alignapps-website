import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  FolderOpen,
  Upload,
  Trash2,
  FileText,
  Image as ImageIcon,
  File,
  X,
  Plus,
  AlertCircle,
  ExternalLink,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeamStore } from '@/lib/store';
import {
  fetchTeamFiles,
  uploadTeamFile,
  deleteTeamFile,
  formatFileSize,
  fileTypeLabel,
  type TeamFile,
} from '@/lib/team-files-api';
import { pickImageFile, pickDocumentFile } from '@/lib/team-file-picker';

// ─── File type icon ───────────────────────────────────────────────────────────
function FileIcon({ contentType, size = 22 }: { contentType: string; size?: number }) {
  if (contentType.startsWith('image/')) {
    return <ImageIcon size={size} color="#67e8f9" />;
  }
  if (contentType === 'application/pdf') {
    return <FileText size={size} color="#f87171" />;
  }
  return <File size={size} color="#a78bfa" />;
}

// ─── Type badge color ─────────────────────────────────────────────────────────
function typeBadgeStyle(contentType: string): { bg: string; text: string } {
  if (contentType.startsWith('image/')) return { bg: '#164e63', text: '#67e8f9' };
  if (contentType === 'application/pdf') return { bg: '#450a0a', text: '#fca5a5' };
  if (contentType.includes('word')) return { bg: '#1e3a5f', text: '#93c5fd' };
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return { bg: '#14532d', text: '#86efac' };
  return { bg: '#312e81', text: '#c4b5fd' };
}

// ─── Upload picker modal ──────────────────────────────────────────────────────
function UploadModal({
  visible,
  onClose,
  onPickImage,
  onPickDocument,
}: {
  visible: boolean;
  onClose: () => void;
  onPickImage: () => void;
  onPickDocument: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
      >
        <Pressable onPress={() => {}}>
          <View
            style={{
              backgroundColor: '#1e293b',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 48,
            }}
          >
            <View style={{ width: 36, height: 4, backgroundColor: '#475569', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
              Upload File
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24, lineHeight: 18 }}>
              Allowed: PDFs, images (JPG, PNG), Word, Excel, and text files.{'\n'}Videos and audio are not supported.
            </Text>

            {/* Photo/Image */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPickImage(); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#0f172a',
                borderRadius: 14,
                padding: 16,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#1e3a5f',
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#164e63', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <ImageIcon size={22} color="#67e8f9" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 15 }}>Photo / Image</Text>
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>JPG, PNG, HEIC from your camera roll</Text>
              </View>
            </Pressable>

            {/* Document */}
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPickDocument(); }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#0f172a',
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: '#2d1b69',
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#2d1b69', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                <FileText size={22} color="#c4b5fd" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f1f5f9', fontWeight: '600', fontSize: 15 }}>Document</Text>
                <Text style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>PDF, Word, Excel, or text file</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────
function DeleteModal({
  file,
  onClose,
  onConfirm,
  isDeleting,
}: {
  file: TeamFile | null;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  if (!file) return null;
  return (
    <Modal visible={!!file} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View
          entering={FadeInUp.duration(200)}
          style={{ backgroundColor: '#1e293b', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}
        >
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#450a0a', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <Trash2 size={24} color="#f87171" />
            </View>
            <Text style={{ color: '#f1f5f9', fontSize: 17, fontWeight: '700', textAlign: 'center' }}>Delete File?</Text>
            <Text style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
              "{file.displayName}" will be permanently removed.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={onClose}
              style={{ flex: 1, backgroundColor: '#334155', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#f1f5f9', fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={isDeleting}
              style={{ flex: 1, backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
              )}
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FileStorageScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeTeamId = useTeamStore((s) => s.activeTeamId);
  const isAdminFn = useTeamStore((s) => s.isAdmin);
  const isAdmin = isAdminFn();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<TeamFile | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Track files uploaded this session in local state so they show instantly
  // without depending on React Query's cache invalidation / refetch timing.
  const [pendingFiles, setPendingFiles] = useState<TeamFile[]>([]);

  const teamId = activeTeamId ?? '';

  const { data: serverFiles = [], isLoading, error } = useQuery({
    queryKey: ['team-files', teamId],
    queryFn: () => fetchTeamFiles(teamId),
    enabled: !!teamId,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  // Merge server list with locally-uploaded files; server wins on id collision
  const serverIds = new Set(serverFiles.map((f) => f.id));
  const files = [
    ...serverFiles,
    ...pendingFiles.filter((f) => !serverIds.has(f.id)),
  ];
  const uploadMutation = useMutation({
    mutationFn: ({
      uri,
      filename,
      mimeType,
    }: {
      uri: string;
      filename: string;
      mimeType: string;
    }) => uploadTeamFile(uri, filename, mimeType, teamId),
    onSuccess: (newFile: TeamFile) => {
      setPendingFiles((prev) => [...prev.filter((f) => f.id !== newFile.id), newFile]);
      queryClient.setQueryData<TeamFile[]>(['team-files', teamId], (old = []) => [
        ...old.filter((f) => f.id !== newFile.id),
        newFile,
      ]);
      setShowUploadModal(false);
      setUploadError(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: Error) => {
      setUploadError(err.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (filePath: string) => deleteTeamFile(filePath),
    onSuccess: (_, filePath) => {
      setPendingFiles((prev) => prev.filter((f) => f.path !== filePath));
      queryClient.invalidateQueries({ queryKey: ['team-files', teamId] });
      setFileToDelete(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: () => {
      setFileToDelete(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const handlePickImage = async () => {
    setUploadError(null);
    uploadMutation.reset();
    const picked = await pickImageFile();
    if (!picked) return;
    setShowUploadModal(false);
    uploadMutation.mutate({ uri: picked.uri, filename: picked.filename, mimeType: picked.mimeType });
  };

  const handlePickDocument = async () => {
    setUploadError(null);
    uploadMutation.reset();
    const picked = await pickDocumentFile();
    if (!picked) return;
    setShowUploadModal(false);
    uploadMutation.mutate({ uri: picked.uri, filename: picked.filename, mimeType: picked.mimeType });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#0f172a']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeIn.delay(50)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(30,41,59,0.8)', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}
          >
            <ArrowLeft size={20} color="#67e8f9" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '500' }}>Teams</Text>
            <Text style={{ color: '#f1f5f9', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}>File Storage</Text>
          </View>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(103,232,249,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <FolderOpen size={20} color="#67e8f9" />
          </View>
        </Animated.View>

        {/* File type note */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <View style={{
            backgroundColor: 'rgba(15,23,42,0.8)',
            borderRadius: 14,
            padding: 14,
            borderWidth: 1,
            borderColor: '#1e293b',
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <AlertCircle size={16} color="#67e8f9" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#67e8f9', fontSize: 12, fontWeight: '700', marginBottom: 2 }}>
                Supported File Types
              </Text>
              <Text style={{ color: '#64748b', fontSize: 12, lineHeight: 17 }}>
                Images (JPG, PNG, HEIC) · PDF · Word · Excel · Text{'\n'}
                Videos and audio files are not supported.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Upload error */}
        {uploadError && (
          <Animated.View entering={FadeInDown} style={{ marginHorizontal: 20, marginBottom: 12 }}>
            <View style={{ backgroundColor: '#450a0a', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <X size={14} color="#f87171" />
              <Text style={{ color: '#fca5a5', fontSize: 13, flex: 1 }}>{uploadError}</Text>
            </View>
          </Animated.View>
        )}

        {/* Upload in progress */}
        {uploadMutation.isPending && (
          <Animated.View entering={FadeInDown} style={{ marginHorizontal: 20, marginBottom: 12 }}>
            <View style={{ backgroundColor: '#164e63', borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator size="small" color="#67e8f9" />
              <Text style={{ color: '#67e8f9', fontSize: 13, fontWeight: '600' }}>Uploading file...</Text>
            </View>
          </Animated.View>
        )}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <ActivityIndicator size="large" color="#67e8f9" />
              <Text style={{ color: '#64748b', marginTop: 12, fontSize: 14 }}>Loading files...</Text>
            </View>
          ) : error ? (
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ color: '#f87171', fontSize: 14 }}>Failed to load files</Text>
            </View>
          ) : files.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(200)} style={{ alignItems: 'center', paddingTop: 60 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(103,232,249,0.08)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <FolderOpen size={36} color="#334155" />
              </View>
              <Text style={{ color: '#f1f5f9', fontSize: 17, fontWeight: '700', marginBottom: 6 }}>No files yet</Text>
              <Text style={{ color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
                Upload PDFs, images, and documents{'\n'}to share with your team.
              </Text>
            </Animated.View>
          ) : (
            [...new Map(files.map((f) => [f.id, f])).values()].map((file, index) => {
              const badge = typeBadgeStyle(file.contentType);
              return (
                <Animated.View key={file.id} entering={FadeInDown.delay(index * 50).springify()}>
                  <View style={{
                    backgroundColor: 'rgba(30,41,59,0.6)',
                    borderRadius: 16,
                    padding: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: '#1e293b',
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}>
                    {/* Icon */}
                    <View style={{
                      width: 46,
                      height: 46,
                      borderRadius: 12,
                      backgroundColor: 'rgba(15,23,42,0.8)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 14,
                    }}>
                      <FileIcon contentType={file.contentType} size={22} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text
                        style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600', marginBottom: 4 }}
                        numberOfLines={2}
                      >
                        {file.displayName}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ backgroundColor: badge.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: badge.text, fontSize: 11, fontWeight: '700' }}>
                            {fileTypeLabel(file.contentType)}
                          </Text>
                        </View>
                        <Text style={{ color: '#64748b', fontSize: 11 }}>
                          {formatFileSize(file.sizeBytes)}
                        </Text>
                        <Text style={{ color: '#475569', fontSize: 11 }}>
                          {new Date(file.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          Linking.openURL(file.url);
                        }}
                        style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(103,232,249,0.1)', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ExternalLink size={16} color="#67e8f9" />
                      </Pressable>
                      {isAdmin && (
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setFileToDelete(file);
                          }}
                          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.1)', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={16} color="#f87171" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}
        </ScrollView>

        {/* Upload FAB */}
        <Animated.View
          entering={FadeInUp.delay(300).springify()}
          style={{
            position: 'absolute',
            bottom: 36,
            right: 24,
          }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setUploadError(null);
              setShowUploadModal(true);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#0891b2',
              borderRadius: 28,
              paddingVertical: 14,
              paddingHorizontal: 22,
              shadowColor: '#0891b2',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.45,
              shadowRadius: 12,
              elevation: 8,
              gap: 8,
            }}
          >
            <Plus size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Upload</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>

      {/* Modals */}
      <UploadModal
        visible={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onPickImage={handlePickImage}
        onPickDocument={handlePickDocument}
      />
      <DeleteModal
        file={fileToDelete}
        onClose={() => setFileToDelete(null)}
        onConfirm={() => fileToDelete && deleteMutation.mutate(fileToDelete.path)}
        isDeleting={deleteMutation.isPending}
      />
    </View>
  );
}
