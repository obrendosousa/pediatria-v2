'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Camera, Loader2, Eye, EyeOff, User, Shield, Mail, Check, Smile, ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const DICEBEAR_STYLES = [
  'adventurer', 'adventurer-neutral', 'avataaars', 'avataaars-neutral',
  'big-ears', 'big-ears-neutral', 'big-smile', 'bottts', 'bottts-neutral',
  'croodles', 'croodles-neutral', 'fun-emoji', 'icons',
  'lorelei', 'lorelei-neutral', 'micah', 'miniavs',
  'notionists', 'notionists-neutral', 'open-peeps', 'personas',
  'pixel-art', 'pixel-art-neutral', 'thumbs',
] as const;

function getDiceBearUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

interface ProfilePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export default function ProfilePopover({ isOpen, onClose, anchorRef }: ProfilePopoverProps) {
  const { profile, refreshProfile } = useAuth();
  const popoverRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen && profile) {
      setFullName(profile.full_name || '');
      setPhotoPreview(profile.photo_url || null);
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      setShowAvatarPicker(false);
      setSelectedStyle(null);
      setFeedback(null);
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !profile) return null;

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload/profile-photo', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        showFeedback('error', data.error || 'Erro ao enviar foto');
        setPhotoPreview(profile.photo_url || null);
        return;
      }
      setPhotoPreview(data.url);
      await refreshProfile();
      showFeedback('success', 'Foto atualizada');
    } catch {
      showFeedback('error', 'Erro ao enviar foto');
      setPhotoPreview(profile.photo_url || null);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectAvatar = async (url: string) => {
    setSavingAvatar(true);
    setPhotoPreview(url);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({ photo_url: url })
        .eq('id', profile.id);
      if (error) {
        showFeedback('error', 'Erro ao salvar avatar');
        setPhotoPreview(profile.photo_url || null);
        return;
      }
      await refreshProfile();
      showFeedback('success', 'Avatar atualizado');
      setShowAvatarPicker(false);
    } catch {
      showFeedback('error', 'Erro ao salvar avatar');
      setPhotoPreview(profile.photo_url || null);
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleSaveName = async () => {
    if (!fullName.trim() || fullName.trim() === profile.full_name) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showFeedback('error', data.error || 'Erro ao salvar'); return; }
      await refreshProfile();
      showFeedback('success', 'Nome atualizado');
    } catch {
      showFeedback('error', 'Erro ao salvar');
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { showFeedback('error', 'A senha deve ter pelo menos 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { showFeedback('error', 'As senhas não coincidem'); return; }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { showFeedback('error', data.error || 'Erro ao trocar senha'); return; }
      setNewPassword('');
      setConfirmPassword('');
      showFeedback('success', 'Senha alterada com sucesso');
    } catch {
      showFeedback('error', 'Erro ao trocar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  const roleLabel = profile.role === 'admin' ? 'Administrador' : 'Secretária';
  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  const seed = profile.full_name || profile.email || profile.id;

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-[360px] bg-white dark:bg-[#0f0f14] rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-[#2d2d36] z-[100] animate-in fade-in slide-in-from-top-2 duration-200"
    >
      {/* Feedback */}
      {feedback && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
        }`}>
          {feedback.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
          {feedback.message}
        </div>
      )}

      <div className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">

        {/* ═══ Avatar Picker View ═══ */}
        {showAvatarPicker ? (
          <div>
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => {
                  if (selectedStyle) {
                    setSelectedStyle(null);
                  } else {
                    setShowAvatarPicker(false);
                  }
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-gray-400" />
              </button>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                {selectedStyle ? selectedStyle.charAt(0).toUpperCase() + selectedStyle.slice(1).replace(/-/g, ' ') : 'Escolha um estilo'}
              </h3>
            </div>

            {savingAvatar && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                <span className="ml-2 text-xs text-slate-500">Salvando...</span>
              </div>
            )}

            {!selectedStyle ? (
              /* ── Grid de estilos ── */
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                {DICEBEAR_STYLES.map((style) => {
                  const previewSeeds = [seed, `${seed}-2`, `${seed}-3`, `${seed}-4`];
                  return (
                    <button
                      key={style}
                      onClick={() => setSelectedStyle(style)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      {/* Preview de 4 avatares */}
                      <div className="flex -space-x-2">
                        {previewSeeds.map((s, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={getDiceBearUrl(style, s)}
                            alt=""
                            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 border-2 border-white dark:border-[#0f0f14] object-contain"
                            loading="lazy"
                          />
                        ))}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-semibold text-slate-700 dark:text-gray-200 group-hover:text-slate-900 dark:group-hover:text-white capitalize">
                          {style.replace(/-/g, ' ')}
                        </p>
                      </div>
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-300 dark:text-gray-600 rotate-180" />
                    </button>
                  );
                })}
              </div>
            ) : (
              /* ── Grid de variações do estilo selecionado ── */
              <div className="grid grid-cols-4 gap-2 max-h-[50vh] overflow-y-auto p-1">
                {Array.from({ length: 20 }, (_, i) => {
                  const variantSeed = i === 0 ? seed : `${seed}-v${i}`;
                  const url = getDiceBearUrl(selectedStyle, variantSeed);
                  return (
                    <button
                      key={i}
                      onClick={() => handleSelectAvatar(url)}
                      disabled={savingAvatar}
                      className="w-full aspect-square rounded-xl bg-slate-50 dark:bg-white/5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none ring-2 ring-transparent hover:ring-violet-400 dark:hover:ring-violet-500 hover:brightness-105 hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] transition-[box-shadow,filter] duration-200 ease-out"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`${selectedStyle} ${i + 1}`}
                        className="w-full h-full object-contain p-1.5 rounded-xl"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ═══ Normal Profile View ═══ */}

            {/* Foto + Info principal */}
            <div className="flex items-center gap-3">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center ring-2 ring-white dark:ring-[#1c1c21] shadow-md">
                  {photoPreview ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-white">{initials}</span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-slate-800 dark:text-[#fafafa] truncate">
                  {profile.full_name || 'Sem nome'}
                </p>
                <p className="text-xs text-slate-500 dark:text-[#71717a] truncate">{profile.email}</p>
                <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  profile.role === 'admin'
                    ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400'
                    : 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                }`}>
                  <Shield className="w-2.5 h-2.5" />
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Botão escolher avatar */}
            <button
              onClick={() => setShowAvatarPicker(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 rounded-lg transition-colors cursor-pointer"
            >
              <Smile className="w-3.5 h-3.5" />
              Escolher avatar
            </button>

            <div className="border-t border-slate-100 dark:border-[#2d2d36]" />

            {/* Nome editável */}
            <div>
              <label className="text-[11px] font-medium text-slate-500 dark:text-[#71717a] flex items-center gap-1 mb-1">
                <User className="w-3 h-3" /> Nome completo
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#1c1c21] text-slate-800 dark:text-[#fafafa] text-sm outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700 transition-all"
                  placeholder="Seu nome"
                />
                {fullName.trim() !== (profile.full_name || '') && (
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    className="px-2.5 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {savingName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Salvar
                  </button>
                )}
              </div>
            </div>

            {/* Email readonly */}
            <div>
              <label className="text-[11px] font-medium text-slate-500 dark:text-[#71717a] flex items-center gap-1 mb-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#3d3d48] bg-slate-50 dark:bg-[#111115] text-slate-500 dark:text-[#71717a] text-xs cursor-not-allowed"
              />
            </div>

            <div className="border-t border-slate-100 dark:border-[#2d2d36]" />

            {/* Trocar senha */}
            {!showPasswordSection ? (
              <button
                onClick={() => setShowPasswordSection(true)}
                className="w-full px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a1a1aa] hover:text-slate-800 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors text-left"
              >
                Alterar senha
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-500 dark:text-[#a1a1aa] uppercase tracking-wider">
                    Alterar Senha
                  </h4>
                  <button
                    onClick={() => { setShowPasswordSection(false); setNewPassword(''); setConfirmPassword(''); }}
                    className="text-slate-400 dark:text-[#71717a] hover:text-slate-600 dark:hover:text-[#a1a1aa]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-[#71717a] mb-1 block">
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 pr-8 rounded-lg border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#1c1c21] text-slate-800 dark:text-[#fafafa] text-sm outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700 transition-all"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#71717a] hover:text-slate-600 dark:hover:text-[#a1a1aa]"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-[#71717a] mb-1 block">
                    Confirmar nova senha
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#3d3d48] bg-white dark:bg-[#1c1c21] text-slate-800 dark:text-[#fafafa] text-sm outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-700 transition-all"
                    placeholder="Repita a nova senha"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[10px] text-red-500 mt-0.5">As senhas não coincidem</p>
                  )}
                </div>

                <button
                  onClick={handleChangePassword}
                  disabled={savingPassword || !newPassword || newPassword !== confirmPassword}
                  className="w-full px-3 py-2 bg-slate-800 dark:bg-white/10 hover:bg-slate-900 dark:hover:bg-white/15 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Alterando...
                    </>
                  ) : (
                    'Alterar Senha'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
