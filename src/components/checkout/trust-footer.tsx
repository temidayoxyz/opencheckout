import { Lock } from "lucide-react";
import Image from "next/image";

export function TrustFooter() {
  return (
    <footer className="mt-12 pt-8 border-t border-hairline">
      <div className="flex items-center justify-center gap-2 text-sm text-ink-soft font-[330]">
        <Lock className="w-4 h-4" />
        <span>Secured by</span>
        <Image
          src="/logo-light.png"
          alt="OpenCheckout"
          width={873}
          height={286}
          className="h-14 w-auto"
        />
      </div>
    </footer>
  );
}
