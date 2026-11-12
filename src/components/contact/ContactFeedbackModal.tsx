"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useImperativeHandle, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { CheckCircle2, ImagePlus, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  B2B_TAGS,
  CONTACT_CATEGORIES,
  DEFAULT_SUBTYPE,
  IDEA_SUBTYPES,
  IMAGE_CATEGORIES,
  MAX_ATTACHMENTS,
  MEETING_FORMS,
  MODULE_LABEL,
  PARTNER_TYPES,
  QR_REQUESTS,
  QR_SIZES,
  SINGLE_CONTACT_CATEGORIES,
  contactCategory,
  contactSchema,
  contextFromPath,
  projectHref,
  type ContactCategory,
  type ContactDiagnostics,
} from "@/lib/contact";
import { cn } from "@/lib/utils";

import { contactPageContext, type ContactOpenRequest } from "./contact-events";
import { compressImage, imagesFromTransfer, type CompressedImage } from "./image-compress";

// Fáze 107: chytrý kontaktní formulář se 7 kategoriemi (dlaždice nahoře přizpůsobí pole) – vyplnění do 20 vteřin.
// Printscreeny třemi způsoby: Ctrl + V (vložení ze schránky na celém modalu / celé stránce /kontakt), přetažení myší
// a výběr souboru nebo vyfocení mobilem; každý obrázek se zmenší v prohlížeči (canvas, max. 1600 px, WebP / JPEG 0,82).

export interface ContactFormHandle {
  /** Vložení ze schránky (onPaste celého modalu). */
  paste: (event: PasteLike) => void;
}
type PasteLike = { clipboardData: DataTransfer | null; preventDefault: () => void };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Diagnostika z prohlížeče: adresa, modul a krok průvodce (z adresy, editoru nebo tlačítka), projekt, okno, prohlížeč. */
function browserDiagnostics(context: ContactOpenRequest["context"]): ContactDiagnostics {
  const derived = contextFromPath(window.location.pathname);
  const page = contactPageContext() ?? {};
  return {
    currentUrl: window.location.href.slice(0, 500),
    module: context?.module ?? page.module ?? derived.module,
    wizardPhase: context?.wizardPhase ?? page.wizardPhase ?? derived.wizardPhase,
    projectId: context?.projectId ?? page.projectId ?? derived.projectId,
    viewportSize: `${window.innerWidth}×${window.innerHeight}`,
    userAgent: navigator.userAgent.slice(0, 400),
  };
}

function Chip({ active, onClick, children, testId }: { active: boolean; onClick: () => void; children: ReactNode; testId: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors",
        active ? "border-primary bg-primary/15 font-semibold text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1 text-xs font-medium text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}

export function ContactForm({
  ref,
  variant,
  initialCategory = "BUG",
  context,
  onClose,
}: {
  ref?: Ref<ContactFormHandle>;
  variant: "modal" | "page";
  initialCategory?: ContactCategory;
  context?: ContactOpenRequest["context"];
  onClose?: () => void;
}) {
  const [category, setCategory] = useState<ContactCategory>(initialCategory);
  const [subtypes, setSubtypes] = useState<Partial<Record<string, string>>>(DEFAULT_SUBTYPE);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [ico, setIco] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [mpn, setMpn] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [qrSizes, setQrSizes] = useState<string[]>([]);
  const [quantity, setQuantity] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [images, setImages] = useState<CompressedImage[]>([]);
  const [processing, setProcessing] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ares, setAres] = useState<string | null>(null);
  const [done, setDone] = useState<{ ticketLabel: string; reply: string } | null>(null);
  // Diagnostika k náhledu (modal se otevírá jen v prohlížeči; na stránce /kontakt se přiloží až při odeslání)
  const [preview] = useState<ContactDiagnostics | null>(() => (variant === "modal" && typeof window !== "undefined" ? browserDiagnostics(context) : null));
  const fileInput = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<CompressedImage[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  // Náhledy (object URL) uvolnit při zavření formuláře
  useEffect(() => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl)), []);

  const withImages = IMAGE_CATEGORIES.includes(category);
  const singleContact = SINGLE_CONTACT_CATEGORIES.includes(category);
  const meta = contactCategory(category);

  async function addFiles(files: File[]) {
    if (!files.length) return;
    if (!IMAGE_CATEGORIES.includes(category)) return void toast.info("Printscreen přiložíte k hlášení chyby, tipu na zlepšení nebo dotazu do poradny – přepněte nahoře kategorii.");
    const free = MAX_ATTACHMENTS - imagesRef.current.length - processing;
    if (free <= 0) return void toast.warning(`Přiložit lze nejvýš ${MAX_ATTACHMENTS} obrázky – nejdřív některý odeberte (×).`);
    const accepted = files.slice(0, free);
    if (files.length > free) toast.warning(`Přiložím jen ${free} – maximum jsou ${MAX_ATTACHMENTS} obrázky.`);
    setProcessing((count) => count + accepted.length);
    for (const file of accepted) {
      try {
        const image = await compressImage(file, file.name || "printscreen");
        setImages((current) => [...current, image].slice(0, MAX_ATTACHMENTS));
      } catch (problem) {
        toast.error(problem instanceof Error ? problem.message : "Obrázek se nepodařilo přiložit.");
      } finally {
        setProcessing((count) => count - 1);
      }
    }
  }

  function handlePaste(event: PasteLike) {
    const files = imagesFromTransfer(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    void addFiles(files);
  }
  useImperativeHandle(ref, () => ({ paste: handlePaste }));

  // Stránka /kontakt: Ctrl + V kdekoli na stránce (modal má vlastní onPaste na celém obsahu)
  const onDocumentPaste = useEffectEvent((event: ClipboardEvent) => handlePaste(event));
  useEffect(() => {
    if (variant !== "page") return;
    const listener = (event: ClipboardEvent) => onDocumentPaste(event);
    document.addEventListener("paste", listener);
    return () => document.removeEventListener("paste", listener);
  }, [variant]);

  function removeImage(index: number) {
    setImages((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((_, position) => position !== index);
    });
  }

  async function lookupIco(value: string) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 8) return setAres(null);
    try {
      const response = await fetch(`/api/ares?ico=${digits}`);
      const data = (await response.json()) as { companyName?: string; city?: string; error?: string };
      if (response.ok && data.companyName) {
        setAres(`✓ ARES: ${data.companyName}${data.city ? `, ${data.city}` : ""}`);
        setCompany((current) => current || data.companyName!);
      } else setAres(data.error ?? "Firmu se v ARES nepodařilo najít – vyplňte název ručně.");
    } catch {
      setAres("ARES je teď nedostupný – vyplňte název ručně.");
    }
  }

  function details(): Record<string, string | string[]> {
    if (category === "IDEA" && subtypes.IDEA === "catalog" && mpn.trim()) return { mpn: mpn.trim() };
    if (category === "B2B" && tags.length) return { tags };
    if (category === "QR") return { ...(qrSizes.length ? { qrSizes } : {}), ...(quantity.trim() ? { quantity: quantity.trim() } : {}), ...(address.trim() ? { address: address.trim() } : {}) };
    return {};
  }

  function reset() {
    imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setMessage("");
    setMpn("");
    setTags([]);
    setQrSizes([]);
    setQuantity("");
    setAddress("");
    setError(null);
    setDone(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (processing) return setError("Počkejte, až se obrázky zmenší.");
    const contactValue = contact.trim();
    const payload = {
      category,
      subtype: subtypes[category] ?? undefined,
      message: message.trim(),
      name: name.trim() || undefined,
      company: company.trim() || undefined,
      ico: ico.replace(/\s/g, "") || undefined,
      email: singleContact ? (EMAIL_PATTERN.test(contactValue) ? contactValue : undefined) : email.trim() || undefined,
      phone: singleContact ? (contactValue && !EMAIL_PATTERN.test(contactValue) ? contactValue : undefined) : phone.trim() || undefined,
      details: details(),
      diagnostics: browserDiagnostics(context),
      website,
    };
    const check = contactSchema.safeParse(payload);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Zkontrolujte prosím formulář.");
    setBusy(true);
    try {
      const body = new FormData();
      body.set("payload", JSON.stringify(payload));
      for (const image of images.slice(0, MAX_ATTACHMENTS)) body.append("images", image.blob, image.name);
      const response = await fetch("/api/contact", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { ticketLabel?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error ?? (response.status === 429 ? "Odeslali jste během chvíle hodně zpráv – zkuste to prosím za minutu." : "Zprávu se nepodařilo odeslat – zkuste to prosím znovu."));
      const reply = payload.email ? `na e-mail ${payload.email}` : payload.phone ? `na telefon ${payload.phone}` : "";
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setImages([]);
      setDone({ ticketLabel: data.ticketLabel ?? "", reply });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Zprávu se nepodařilo odeslat.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4" data-testid="contact-done" role="status">
        <p className="flex items-center gap-2 text-base font-bold text-emerald-200">
          <CheckCircle2 className="size-5" aria-hidden /> Děkujeme, zprávu máme!
        </p>
        <p className="text-sm">
          Číslo vaší zprávy:{" "}
          <b className="font-mono text-base" data-testid="contact-ticket">
            č. {done.ticketLabel}
          </b>
        </p>
        <p className="text-sm text-muted-foreground">
          {done.reply ? `Ozveme se vám ${done.reply} – na číslo zprávy se můžete odvolat.` : "Kontakt jste nenechali – opravu nebo novinku uvidíte přímo v ELDOCKu. Kdybyste chtěli odpověď, napište nám znovu i s e-mailem."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={reset} data-testid="contact-again">
            Napsat další zprávu
          </Button>
          {onClose ? (
            <Button type="button" onClick={onClose}>
              Zavřít
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  const subtypeChips = (options: readonly { id: string; label: string }[], key: string) => (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Upřesnění">
      {options.map((option) => (
        <Chip key={option.id} active={subtypes[key] === option.id} onClick={() => setSubtypes((current) => ({ ...current, [key]: option.id }))} testId={`contact-subtype-${option.id}`}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
  const icoFields = (
    <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <Field label="IČO (doplní ARES)">
        <Input
          value={ico}
          inputMode="numeric"
          maxLength={10}
          placeholder="12345678"
          onChange={(event) => {
            setIco(event.target.value);
            void lookupIco(event.target.value);
          }}
          data-testid="contact-ico"
        />
      </Field>
      <Field label={category === "B2B" ? "Název organizace" : "Firma"}>
        <Input value={company} maxLength={160} onChange={(event) => setCompany(event.target.value)} data-testid="contact-company" />
      </Field>
      {ares ? (
        <p className="text-xs text-emerald-300 sm:col-span-2" data-testid="contact-ares">
          {ares}
        </p>
      ) : null}
    </div>
  );
  const contactPair = (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="E-mail">
        <Input type="email" value={email} maxLength={160} autoComplete="email" onChange={(event) => setEmail(event.target.value)} data-testid="contact-email" />
      </Field>
      <Field label="Telefon">
        <Input type="tel" value={phone} maxLength={40} autoComplete="tel" onChange={(event) => setPhone(event.target.value)} data-testid="contact-phone" />
      </Field>
    </div>
  );
  const nameField = (label: string) => (
    <Field label={label}>
      <Input value={name} maxLength={120} autoComplete="name" onChange={(event) => setName(event.target.value)} data-testid="contact-name" />
    </Field>
  );
  const messageField = (label: string, placeholder: string, rows = 4) => (
    <Field label={label}>
      <Textarea value={message} maxLength={5000} rows={rows} placeholder={placeholder} onChange={(event) => setMessage(event.target.value)} data-testid="contact-message" />
    </Field>
  );
  const project = preview ? projectHref(preview) : null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="contact-form" data-category={category} noValidate>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="O co jde">
        {CONTACT_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={category === item.id}
            onClick={() => {
              setCategory(item.id);
              setError(null);
            }}
            data-testid={`contact-category-${item.id}`}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition-colors",
              category === item.id ? "border-primary bg-primary/15 text-foreground shadow-[0_0_0_1px_var(--color-primary)]" : "border-border bg-card/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            <span className="text-lg leading-none" aria-hidden>
              {item.icon}
            </span>
            {item.tile}
          </button>
        ))}
      </div>
      <p className="text-sm font-semibold" data-testid="contact-heading">
        {meta.icon} {meta.label}
      </p>

      {category === "BUG" ? messageField("Co se stalo / co nefunguje správně?", "např. Po kliknutí na „Vygenerovat rozváděč“ se nic nestane…", 4) : null}
      {category === "IDEA" ? (
        <>
          {subtypeChips(IDEA_SUBTYPES, "IDEA")}
          {messageField(subtypes.IDEA === "catalog" ? "Který přístroj nebo řada vám chybí?" : "Jaký máte nápad?", subtypes.IDEA === "catalog" ? "např. Hager řada gallery – vypínač 1+1" : "např. Hromadné přečíslování okruhů v půdorysu", 3)}
          {subtypes.IDEA === "catalog" ? (
            <Field label="Objednací číslo (MPN) / výrobce – nepovinné">
              <Input value={mpn} maxLength={200} onChange={(event) => setMpn(event.target.value)} data-testid="contact-mpn" />
            </Field>
          ) : null}
        </>
      ) : null}
      {category === "MEETING" ? (
        <>
          {subtypeChips(MEETING_FORMS, "MEETING")}
          <div className="grid gap-2 sm:grid-cols-2">{nameField("Jméno")}</div>
          {icoFields}
          {contactPair}
          {messageField("Preferovaný termín / poznámka", "např. příští týden v úterý dopoledne, zajímá nás 2D půdorys", 2)}
        </>
      ) : null}
      {category === "PARTNER" ? (
        <>
          {subtypeChips(PARTNER_TYPES, "PARTNER")}
          <div className="grid gap-2 sm:grid-cols-2">{nameField("Jméno")}</div>
          {icoFields}
          {contactPair}
          {messageField("Krátká zpráva (region, kapacity, používaný CAD)", "např. Liberecký kraj, 3 montážníci, EPLAN P8", 3)}
        </>
      ) : null}
      {category === "B2B" ? (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Zájem">
            {B2B_TAGS.map((tag) => (
              <Chip key={tag.id} active={tags.includes(tag.id)} onClick={() => setTags((current) => (current.includes(tag.id) ? current.filter((item) => item !== tag.id) : [...current, tag.id]))} testId={`contact-tag-${tag.id}`}>
                {tag.label}
              </Chip>
            ))}
          </div>
          {icoFields}
          <div className="grid gap-2 sm:grid-cols-2">{nameField("Kontaktní osoba")}</div>
          {contactPair}
          {messageField("Co potřebujete? (nepovinné)", "např. 120 rozváděčů ve 3 halách, revize a lhůtník", 2)}
        </>
      ) : null}
      {category === "QR" ? (
        <>
          {subtypeChips(QR_REQUESTS, "QR")}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Velikosti štítků">
            {QR_SIZES.map((size) => (
              <Chip key={size} active={qrSizes.includes(size)} onClick={() => setQrSizes((current) => (current.includes(size) ? current.filter((item) => item !== size) : [...current, size]))} testId={`contact-qr-size-${QR_SIZES.indexOf(size)}`}>
                {size}
              </Chip>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {nameField("Jméno")}
            <Field label="Firma">
              <Input value={company} maxLength={160} onChange={(event) => setCompany(event.target.value)} data-testid="contact-company" />
            </Field>
          </div>
          <Field label="Adresa doručení">
            <Input value={address} maxLength={300} autoComplete="street-address" onChange={(event) => setAddress(event.target.value)} data-testid="contact-address" />
          </Field>
          {contactPair}
          <Field label="Odhadovaný počet ks" className="sm:max-w-48">
            <Input value={quantity} maxLength={40} inputMode="numeric" placeholder="např. 500" onChange={(event) => setQuantity(event.target.value)} data-testid="contact-quantity" />
          </Field>
        </>
      ) : null}
      {category === "ADVICE" ? (
        <>
          {messageField("S čím potřebujete poradit?", "např. Musí mít okruh pro koupelnu v RD vlastní chránič 30 mA?", 4)}
          <p className="text-xs text-muted-foreground" data-testid="contact-advice-project">
            {project ? (
              <>
                📎 Přiložíme odkaz na otevřený projekt:{" "}
                <Link href={project} className="font-mono text-primary underline-offset-2 hover:underline">
                  {project}
                </Link>
              </>
            ) : (
              "📎 Pošlete-li dotaz z otevřeného půdorysu nebo rozváděče, odkaz na projekt se přiloží sám."
            )}
          </p>
        </>
      ) : null}

      {singleContact ? (
        <Field label={category === "BUG" ? "Váš e-mail nebo telefon (abychom vám dali vědět, až to opravíme)" : category === "ADVICE" ? "Váš e-mail nebo telefon (kam poslat odpověď)" : "Váš e-mail nebo telefon (nepovinné)"}>
          <Input value={contact} maxLength={160} autoComplete="email" placeholder="jan.novak@firma.cz nebo +420 …" onChange={(event) => setContact(event.target.value)} data-testid="contact-contact" />
        </Field>
      ) : null}

      {withImages ? (
        <section
          className={cn("flex flex-col gap-2 rounded-xl border-2 border-dashed p-3 transition-colors", dragging ? "border-primary bg-primary/10" : "border-border")}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void addFiles(imagesFromTransfer(event.dataTransfer));
          }}
          aria-label="Přiložit printscreen nebo fotku"
          data-testid="contact-dropzone"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">📷 Přiložit printscreen nebo fotku (až {MAX_ATTACHMENTS} obrázky)</p>
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => fileInput.current?.click()} disabled={images.length + processing >= MAX_ATTACHMENTS} data-testid="contact-pick">
              <ImagePlus className="size-4" aria-hidden /> Vybrat soubor / vyfotit
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            <kbd className="rounded border border-border px-1">Ctrl</kbd> + <kbd className="rounded border border-border px-1">V</kbd> vloží výstřižek obrazovky (<kbd className="rounded border border-border px-1">Win</kbd> +{" "}
            <kbd className="rounded border border-border px-1">Shift</kbd> + <kbd className="rounded border border-border px-1">S</kbd> nebo <kbd className="rounded border border-border px-1">PrintScreen</kbd>) · obrázek můžete i přetáhnout sem
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            tabIndex={-1}
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
            data-testid="contact-file"
          />
          {images.length || processing ? (
            <ul className="grid grid-cols-3 gap-2">
              {images.map((image, index) => (
                <li key={image.previewUrl} className="relative" data-testid="contact-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element -- náhled zmenšeného printscreenu (object URL) */}
                  <img src={image.previewUrl} alt={`Příloha ${index + 1}`} className="h-24 w-full rounded-md border border-border bg-white object-contain" />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={`Odebrat obrázek ${index + 1}`}
                    className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-red-600 text-white shadow hover:bg-red-500"
                    data-testid="contact-preview-remove"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
              {Array.from({ length: processing }, (_, index) => (
                <li key={`processing-${index}`} className="grid h-24 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> zmenšuji…
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {category === "BUG" || category === "ADVICE" ? (
        <details className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground" data-testid="contact-diagnostics">
          <summary className="cursor-pointer">🔧 Technická diagnostika – přiloží se automaticky, nic nevyplňujete</summary>
          {preview ? (
            <dl className="mt-2 grid grid-cols-[8rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 break-all">
              <dt>Stránka</dt>
              <dd data-testid="contact-diag-url">{preview.currentUrl}</dd>
              <dt>Modul / krok</dt>
              <dd data-testid="contact-diag-module">
                {MODULE_LABEL[preview.module ?? ""] ?? preview.module ?? "–"}
                {preview.wizardPhase ? ` · ${preview.wizardPhase}` : ""}
              </dd>
              <dt>Projekt</dt>
              <dd className="font-mono" data-testid="contact-diag-project">
                {preview.projectId ?? "–"}
              </dd>
              <dt>Okno</dt>
              <dd>{preview.viewportSize}</dd>
              <dt>Prohlížeč</dt>
              <dd>{preview.userAgent}</dd>
            </dl>
          ) : (
            <p className="mt-2">Adresa stránky, modul a krok průvodce, otevřený projekt, velikost okna a prohlížeč.</p>
          )}
        </details>
      ) : null}

      <input type="text" name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {error ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert" data-testid="contact-error">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="touch-target gap-2 font-bold" disabled={busy || processing > 0} data-testid="contact-submit">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />} Odeslat zprávu
        </Button>
        <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
          Odesláním souhlasíte se zpracováním údajů pro vyřízení zprávy –{" "}
          <Link href="/ochrana-osobnich-udaju#kontaktni-formular" target={variant === "modal" ? "_blank" : undefined} className="underline underline-offset-2 hover:text-foreground">
            zásady ochrany osobních údajů
          </Link>
          .
        </p>
      </div>
    </form>
  );
}

/** Hlavní modal „💬 Nápověda, Chyby & Kontakt“ – Ctrl + V (onPaste) funguje na celém obsahu modalu. */
export function ContactFeedbackModal({ open, onOpenChange, request }: { open: boolean; onOpenChange: (open: boolean) => void; request: ContactOpenRequest & { key: number } }) {
  const form = useRef<ContactFormHandle>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" onPaste={(event) => form.current?.paste(event)} data-testid="contact-modal">
        <DialogHeader>
          <DialogTitle>💬 Nápověda, Chyby & Kontakt</DialogTitle>
          <DialogDescription>Vyplnění zabere do 20 vteřin. Printscreen vložíte rovnou přes Ctrl + V – kdekoli v tomto okně.</DialogDescription>
        </DialogHeader>
        <ContactForm key={request.key} ref={form} variant="modal" initialCategory={request.category} context={request.context} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
