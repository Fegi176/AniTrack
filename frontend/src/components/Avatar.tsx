import { useState } from "react";
import type { User } from "../types";

export function Avatar({ user }: { user: User }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <span className="avatar" aria-hidden="true">
      {user.avatarUrl && failedUrl !== user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          onError={() => setFailedUrl(user.avatarUrl)}
        />
      ) : (
        Array.from(user.displayName.trim())[0]?.toLocaleUpperCase() || "?"
      )}
    </span>
  );
}
