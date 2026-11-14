import { useState } from "react";
import { LoaderCircle, Plus, X } from "lucide-react";
import { useApi } from "../../helpers/api";
import { shrinkImage } from "../../helpers/image";
import { rowId, type CardOf, type CardPhoto } from "../../helpers/goalCards";

const MAX_PHOTOS = 24;

export default function PhotosCard({
  card,
  editing,
  onData,
}: Readonly<{
  card: CardOf<"photos">;
  editing: boolean;
  onData: (data: CardOf<"photos">["data"]) => void;
}>) {
  const api = useApi();
  const { photos } = card.data;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file, like a JPG or PNG.");
      return;
    }
    setBusy(true);
    try {
      const photo = await shrinkImage(file);
      const { url } = await api<{ url: string }>("/photos", {
        method: "POST",
        body: photo,
        headers: { "content-type": photo.type },
      });
      onData({ photos: [...photos, { id: rowId(), url, caption: "" }] });
    } catch {
      setError("The photo didn't upload. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  const change = (id: string, edits: Partial<CardPhoto>) =>
    onData({ photos: photos.map((p) => (p.id === id ? { ...p, ...edits } : p)) });

  return (
    <>
      <div className="gb-photos">
        {photos.map((p) => (
          <figure key={p.id} className="gb-photo">
            <img src={p.url} alt={p.caption} loading="lazy" width={400} height={300} />
            {editing ? (
              <>
                <input
                  className="gb-input"
                  aria-label="Photo caption"
                  placeholder="Caption"
                  value={p.caption}
                  maxLength={120}
                  onChange={(e) => change(p.id, { caption: e.target.value })}
                />
                <button
                  type="button"
                  className="icon-btn gb-photo-remove"
                  aria-label={`Remove ${p.caption || "this photo"}`}
                  onClick={() => onData({ photos: photos.filter((x) => x.id !== p.id) })}
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </>
            ) : (
              p.caption && <figcaption>{p.caption}</figcaption>
            )}
          </figure>
        ))}
        {photos.length < MAX_PHOTOS && (
          <label className={`gb-photo-add${busy ? " is-busy" : ""}`}>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = ""; // so the same file can be picked again
              }}
            />
            {busy ? (
              <LoaderCircle aria-hidden="true" size={20} className="spin" />
            ) : (
              <Plus aria-hidden="true" size={20} />
            )}
            {busy ? "Uploading…" : "Add photo"}
          </label>
        )}
      </div>
      {error && (
        <p className="gb-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}
