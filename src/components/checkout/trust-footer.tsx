import { Lock } from "lucide-react";

export function TrustFooter() {
  return (
    <footer className="mt-12 pt-8 border-t border-hairline">
      <div className="flex items-center justify-center gap-2 text-sm text-ink-soft font-[330]">
        <Lock className="w-4 h-4" />
        <span>
          Secured by{" "}
          <span className="font-semibold text-ink">OpenCheckout</span>
        </span>
      </div>
    </footer>
  );
}
