export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-1 px-4 py-8 text-center text-sm text-slate-500">
        <p className="font-semibold text-slate-700">SEAPEDIA</p>
        <p>Marketplace multi-toko — dibuat untuk COMPFEST 18 Software Engineering Academy.</p>
        <p className="text-xs text-slate-400">© {new Date().getFullYear()} SEAPEDIA</p>
      </div>
    </footer>
  );
}
