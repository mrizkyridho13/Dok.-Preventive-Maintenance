import React, { useEffect, useState } from 'react';
import { X, Building2, User, Calendar, FileText, Check } from 'lucide-react';
import { ReportMeta } from '../types/report';

interface ReportInfoModalProps {
  isOpen: boolean;
  meta: ReportMeta;
  onSave: (meta: ReportMeta) => void;
  onClose: () => void;
}

export const ReportInfoModal: React.FC<ReportInfoModalProps> = ({
  isOpen,
  meta,
  onSave,
  onClose,
}) => {
  const [formData, setFormData] = useState<ReportMeta>(meta);

  useEffect(() => {
    if (isOpen) {
      setFormData(meta);
    }
  }, [isOpen, meta]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-3 flex items-center justify-between border-b border-black">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-300" />
            <div>
              <h3 className="font-bold text-sm leading-tight">Data Kop Laporan Maintenance</h3>
              <p className="text-[10px] text-slate-400">Tercetak pada kop atas setiap lembar A4</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Nama Perusahaan dengan Logo */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-700" />
              Nama Perusahaan
            </label>
            <div className="flex items-center gap-2">
              <img
                src="/logo.jpg"
                alt="Logo PGE"
                className="w-8 h-8 rounded-xs border border-slate-300 object-contain p-0.5 shrink-0"
              />
              <input
                type="text"
                value={formData.companyName || 'PT. PANCA GATRIK ELEKTRINDO'}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-none focus:outline-hidden focus:bg-white"
              />
            </div>
          </div>

          {/* Judul Laporan */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-700" />
              Judul Pekerjaan / Laporan
            </label>
            <input
              type="text"
              value={formData.projectName}
              onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
              placeholder="Contoh: DOKUMENTASI MAINTENANCE PREVENTIF"
              className="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-none focus:outline-hidden focus:bg-white"
            />
          </div>

          {/* Lokasi / Toko */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
              Lokasi Toko / Gudang / Site
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Contoh: SUPERINDO CIKARANG UTARA"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          {/* Nama Teknisi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-600" />
              Nama Teknisi / Tim
            </label>
            <input
              type="text"
              value={formData.technicianName}
              onChange={(e) => setFormData({ ...formData, technicianName: e.target.value })}
              placeholder="Contoh: Budi Santoso / Tim HVAC 1"
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Tanggal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Tanggal
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            {/* No. SPK / WO */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                No. SPK / Tiket (Opsional)
              </label>
              <input
                type="text"
                value={formData.jobOrderNumber}
                onChange={(e) => setFormData({ ...formData, jobOrderNumber: e.target.value })}
                placeholder="SPK-2026/019"
                className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-none text-xs font-bold bg-slate-900 hover:bg-black text-white flex items-center gap-1.5 border border-black"
            >
              <Check className="w-3.5 h-3.5" />
              Simpan Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
