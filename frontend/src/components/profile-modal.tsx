"use client";

import { useState } from "react";
import { Avatar, ErrorMsg, Field, Modal, btnCls, btnGhost, inputCls } from "@/components/ui";
import { API_URL, api, fileUrl, getToken } from "@/lib/api";
import type { User } from "@/lib/auth";

/** A student edits their own name, phone and photo. */
export function ProfileModal({ user, open, onClose }: { user: User & { phone?: string | null }; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal open={open} title="আমার প্রোফাইল" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api("/student/profile", { method: "PATCH", body: { name, phone } });
            if (file) {
              const fd = new FormData();
              fd.append("file", file);
              const res = await fetch(`${API_URL}/student/photo`, { method: "POST", headers: { authorization: `Bearer ${getToken()}` }, body: fd });
              const d = await res.json().catch(() => null);
              if (!res.ok) throw new Error(d?.message ?? "ছবি আপলোড হয়নি");
            }
            window.location.reload();
          } catch (err) {
            setError(err instanceof Error ? err.message : "ব্যর্থ");
            setBusy(false);
          }
        }}
      >
        <div className="flex items-center gap-4">
          <Avatar name={user.name} src={file ? URL.createObjectURL(file) : user.photoUrl ? fileUrl(user.photoUrl) : null} size="size-16" />
          <input type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
        <Field label="নাম">{(i) => <input id={i} className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="মোবাইল">{(i) => <input id={i} className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />}</Field>
        <p className="text-xs text-faint">ইমেইল: {user.email} (বদলানো যাবে না)। ছবি JPG/PNG/WebP, সর্বোচ্চ ২MB।</p>
        <ErrorMsg error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onClose}>বাতিল</button>
          <button className={btnCls} disabled={busy}>{busy ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ"}</button>
        </div>
      </form>
    </Modal>
  );
}
