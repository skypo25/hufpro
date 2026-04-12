import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { DirectoryProfileCreateWizard } from "@/components/directory/onboarding/DirectoryProfileCreateWizard";
import {
  fetchPublicAnimalTypes,
  fetchPublicMethods,
  fetchPublicSpecialties,
  fetchPublicSubcategories,
} from "@/lib/directory/public/data";
import { submitDirectoryProfileWizardForOwnerAction } from "@/app/(app)/directory/mein-profil/actions";
import type { DirectoryOpeningHoursJson } from "@/lib/directory/openingHours";
import type {
  WizardSubmitPayload,
  WizardSubmitSocialLink,
} from "@/lib/directory/onboarding/submitWizardProfile";
import {
  parseCustomMethodsFromDescription,
  parseCustomSpecsFromDescription,
  parseQualiItemsFromDescription,
} from "@/lib/directory/onboarding/parseWizardDescriptionBlocks";
import type { DirectoryProfileCreateWizardInitialMedia } from "@/components/directory/onboarding/DirectoryProfileCreateWizard";
import { BILLING_ACCOUNT_COLUMNS } from "@/lib/billing/billingAccountSelect";
import type { BillingAccountRow } from "@/lib/billing/types";
import { loadDirectoryPublicProfileDiagnostics } from "@/lib/directory/public/loadDirectoryPublicProfileDiagnostics.server";
import { syncAppTopEntitlementFromBilling } from "@/lib/directory/syncAppTopEntitlement.server";

import "@/components/directory/onboarding/profile-create-wizard.css";

export const dynamic = "force-dynamic";

/** Gemeinsamer Profil-Editor (Create/Edit) für App-User & Directory-only User. */
export default async function DirectoryMeinProfilPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const saved = sp.saved === "1";

  const labelListingStatus = (s: string | null | undefined): string => {
    const v = (s ?? "").toString();
    if (!v) return "—";
    if (v === "draft") return "Entwurf";
    if (v === "published") return "Veröffentlicht";
    if (v === "hidden") return "Versteckt";
    if (v === "blocked") return "Gesperrt";
    return v;
  };

  const labelVerificationState = (s: string | null | undefined): string => {
    const v = (s ?? "").toString();
    if (!v) return "—";
    if (v === "none") return "Nicht verifiziert";
    if (v === "pending") return "Prüfung ausstehend";
    if (v === "verified") return "Verifiziert";
    if (v === "rejected") return "Abgelehnt";
    return v;
  };

  const labelTopSource = (s: string): string => {
    if (s === "app_subscription") return "App-Abo";
    if (s === "directory_subscription") return "Verzeichnis-Produkt";
    if (s === "manual") return "Manuell";
    return s;
  };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [specialties, subcategories, methods, animals] = await Promise.all([
    fetchPublicSpecialties(),
    fetchPublicSubcategories(),
    fetchPublicMethods(),
    fetchPublicAnimalTypes(),
  ]);

  const { data: profile } = await supabase
    .from("directory_profiles")
    .select(
      "id, slug, display_name, practice_name, listing_status, verification_state, name_salutation, name_title, first_name, last_name, short_description, description, street, postal_code, city, country, latitude, longitude, phone_public, email_public, service_type, service_radius_km, service_area_text, opening_hours, opening_hours_note",
    )
    .eq("claimed_by_user_id", user.id)
    .maybeSingle();

  const profileId = (profile as { id?: string } | null)?.id ?? null;

  const { data: billingRow } = await supabase
    .from("billing_accounts")
    .select(BILLING_ACCOUNT_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileId) {
    await syncAppTopEntitlementFromBilling({
      directoryProfileId: profileId,
      claimedByUserId: user.id,
      billing: (billingRow as BillingAccountRow | null) ?? null,
    });
  }

  const [specLinks, subLinks, methLinks, aniLinks, socialLinksRows, mediaLinks] =
    profileId
      ? await Promise.all([
          supabase
            .from("directory_profile_specialties")
            .select("directory_specialty_id, is_primary")
            .eq("directory_profile_id", profileId)
            .order("is_primary", { ascending: false }),
          supabase
            .from("directory_profile_subcategories")
            .select("directory_subcategory_id")
            .eq("directory_profile_id", profileId),
          supabase
            .from("directory_profile_methods")
            .select("directory_method_id")
            .eq("directory_profile_id", profileId),
          supabase
            .from("directory_profile_animal_types")
            .select("directory_animal_type_id")
            .eq("directory_profile_id", profileId),
          supabase
            .from("directory_profile_social_links")
            .select("platform, url, sort_order")
            .eq("directory_profile_id", profileId)
            .order("sort_order", { ascending: true }),
          supabase
            .from("directory_profile_media")
            .select("id, media_type, url, sort_order")
            .eq("directory_profile_id", profileId)
            .order("sort_order", { ascending: true }),
        ])
      : [
          { data: null },
          { data: null },
          { data: null },
          { data: null },
          { data: null },
          { data: null },
        ];

  const mediaRows =
    (
      mediaLinks as {
        data?: { id: string; media_type: string; url: string }[] | null;
      } | null
    )?.data ?? [];
  const logoMediaRow = mediaRows.find((m) => m.media_type === "logo");
  const initialMedia: DirectoryProfileCreateWizardInitialMedia | null = profileId
    ? {
        logoUrl: logoMediaRow?.url ?? null,
        photos: mediaRows
          .filter((m) => m.media_type === "photo")
          .map((m) => ({ id: m.id, url: m.url })),
      }
    : null;

  const profileDescription =
    (profile as { description?: string | null } | null)?.description ?? null;

  const orderedSpecialtyIds =
    (
      specLinks as {
        data?: { directory_specialty_id: string; is_primary: boolean }[];
      } | null
    )?.data
      ?.slice()
      .sort((a, b) =>
        a.is_primary === b.is_primary ? 0 : a.is_primary ? -1 : 1,
      )
      .map((x) => x.directory_specialty_id) ?? [];

  const socialRowsFromDb =
    (
      socialLinksRows as {
        data?: { platform: string; url: string }[] | null;
      } | null
    )?.data ?? [];
  const websiteFromSocial = socialRowsFromDb.find((s) => s.platform === "website")?.url ?? "";
  const wizardSocialPlatforms = new Set<string>([
    "instagram",
    "facebook",
    "linkedin",
    "youtube",
    "tiktok",
    "other",
  ]);
  const initialSocialLinks: WizardSubmitSocialLink[] = socialRowsFromDb
    .filter((s) => s.platform !== "website" && wizardSocialPlatforms.has(s.platform))
    .map((s) => ({ platform: s.platform as WizardSubmitSocialLink["platform"], url: s.url }));

  const initial: Partial<WizardSubmitPayload> | null = profile
    ? {
        practiceName:
          (profile as { practice_name?: string | null }).practice_name ?? "",
        nameSalutation:
          (profile as { name_salutation?: string | null }).name_salutation ??
          "",
        nameTitle: (profile as { name_title?: string | null }).name_title ?? "",
        firstName: (profile as { first_name?: string | null }).first_name ?? "",
        lastName: (profile as { last_name?: string | null }).last_name ?? "",
        shortDesc:
          (profile as { short_description?: string | null })
            .short_description ?? "",
        streetLine: (profile as { street?: string | null }).street ?? "",
        plz: (profile as { postal_code?: string | null }).postal_code ?? "",
        city: (profile as { city?: string | null }).city ?? "",
        country: (() => {
          const c = String(
            (profile as { country?: string | null }).country ?? "DE",
          ).toUpperCase();
          return c === "AT" || c === "CH" ? c : "DE";
        })(),
        latitude:
          typeof (profile as { latitude?: number | null }).latitude === "number"
            ? (profile as { latitude: number }).latitude
            : null,
        longitude:
          typeof (profile as { longitude?: number | null }).longitude ===
          "number"
            ? (profile as { longitude: number }).longitude
            : null,
        phone: (profile as { phone_public?: string | null }).phone_public ?? "",
        email: (profile as { email_public?: string | null }).email_public ?? "",
        website: websiteFromSocial,
        socialLinks: initialSocialLinks,
        specialtyIds: orderedSpecialtyIds,
        subcategoryIds:
          (
            subLinks as { data?: { directory_subcategory_id: string }[] } | null
          )?.data?.map((x) => x.directory_subcategory_id) ?? [],
        methodIds:
          (
            methLinks as { data?: { directory_method_id: string }[] } | null
          )?.data?.map((x) => x.directory_method_id) ?? [],
        customSpecs: parseCustomSpecsFromDescription(profileDescription),
        customMethods: parseCustomMethodsFromDescription(profileDescription),
        animalTypeIds:
          (
            aniLinks as { data?: { directory_animal_type_id: string }[] } | null
          )?.data?.map((x) => x.directory_animal_type_id) ?? [],
        serviceType: (() => {
          const st = (profile as { service_type?: string | null }).service_type;
          return st === "mobile" || st === "stationary" || st === "both"
            ? st
            : undefined;
        })(),
        radiusKm: Number(
          (profile as { service_radius_km?: unknown }).service_radius_km ?? 30,
        ),
        areaText:
          (profile as { service_area_text?: string | null })
            .service_area_text ?? "",
        qualiItems: parseQualiItemsFromDescription(profileDescription),
        openingHours:
          (profile as { opening_hours?: unknown }).opening_hours != null
            ? ((profile as { opening_hours?: unknown })
                .opening_hours as DirectoryOpeningHoursJson)
            : undefined,
        openingHoursNote:
          (profile as { opening_hours_note?: string | null })
            .opening_hours_note ?? "",
      }
    : null;

  const { data: topEnts } = profileId
    ? await supabase
        .from("directory_profile_top_entitlements")
        .select("source, active_until")
        .eq("directory_profile_id", profileId)
        .or("active_until.is.null,active_until.gt.now()")
    : { data: null };

  const activeTopSources = (topEnts as
    | { source: string; active_until: string | null }[]
    | null
    | undefined)
    ? [
        ...new Set((topEnts as { source: string }[]).map((e) => e.source)),
      ].sort()
    : [];
  const topActive = activeTopSources.length > 0;
  const topSourcesLabel = activeTopSources.map(labelTopSource).join(", ");

  /** Gleicher Fetch wie `/behandler/[slug]` (Anon + View). Optional: lokal Abgleich mit Service-Role. */
  const publicDx = profile?.slug
    ? await loadDirectoryPublicProfileDiagnostics(profile.slug.trim())
    : null;
  const publicViewContact = publicDx
    ? {
        inPublicDirectory: publicDx.anon.inView,
        topFromView: publicDx.anon.top_active,
        contactFormFromView: publicDx.anon.premium_contact_enabled,
        devBypass: publicDx.devBypass,
      }
    : null;

  const listingOk = profile?.listing_status === "published";
  const verifiedOk = profile?.verification_state === "verified";
  const topOk = topActive;
  const allStatusOk = Boolean(profile && listingOk && verifiedOk && topOk);

  const statusPillClass = (rowOk: boolean) =>
    [
      "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[12px]",
      allStatusOk
        ? "bg-emerald-50/90"
        : rowOk
          ? "bg-emerald-50/70"
          : "bg-white shadow-sm",
    ].join(" ");

  const statusLabelClass = allStatusOk ? "text-emerald-800/85" : "text-slate-500";

  const statusValueClass = (rowOk: boolean) =>
    [
      "font-semibold",
      allStatusOk || rowOk ? "text-emerald-700" : "text-slate-800",
    ].join(" ");

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-7">
      <div className="flex items-center gap-2 text-[13px] text-[#6B7280]">
        <Link href="/dashboard" className="text-[#52b788] hover:underline">
          Dashboard
        </Link>
        <span aria-hidden>›</span>
        <span className="text-[#6B7280]">Mein Profil</span>
      </div>

      <div>
        <h1 className="font-serif text-[28px] font-medium tracking-tight text-[#1B1F23]">
          Mein Profil
        </h1>
        <p className="mt-1 text-[14px] text-[#6B7280]">
          Status, Stammdaten und Darstellung deines Eintrags im Verzeichnis
        </p>
      </div>

      {saved ? (
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-950 shadow-sm">
          <div className="flex items-start gap-2">
            <i
              className="bi bi-check-circle-fill mt-[2px] text-emerald-600"
              aria-hidden
            />
            <div className="min-w-0">
              <div className="font-semibold">Profil gespeichert</div>
              <div className="mt-0.5 text-emerald-900/80">
                Deine Änderungen wurden übernommen. Du kannst jetzt weiter
                bearbeiten oder die Vorschau prüfen.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-7">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div
                  className={
                    allStatusOk
                      ? "text-[13px] font-semibold text-emerald-900"
                      : "text-[13px] font-semibold text-slate-900"
                  }
                >
                  Profil-Status
                </div>
                <div
                  className={
                    allStatusOk
                      ? "mt-0.5 text-[11px] text-emerald-800/75"
                      : "mt-0.5 text-[11px] text-slate-500"
                  }
                >
                  {profile ? (
                    <>
                      {profile.display_name}
                      {profile.slug ? (
                        <>
                          {" "}
                          ·{" "}
                          <span className="font-mono">
                            /behandler/{profile.slug}
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    "Noch kein Profil angelegt"
                  )}
                </div>
              </div>

              {profile &&
              profile.listing_status === "published" &&
              profile.slug ? (
                <a
                  href={`/behandler/${profile.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Öffentliches Profil in neuem Tab"
                  className="huf-btn-dark inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1B1F23] px-4 py-2.5 text-sm font-semibold shadow-none transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B1F23]"
                >
                  Öffentliche Ansicht
                  <i
                    className="bi bi-box-arrow-up-right text-[13px] text-white"
                    aria-hidden
                  />
                </a>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className={statusPillClass(listingOk)}>
                <span className={statusLabelClass}>Listing</span>
                <span className={statusValueClass(listingOk)}>
                  {labelListingStatus(profile?.listing_status)}
                </span>
              </div>
              <div className={statusPillClass(verifiedOk)}>
                <span className={statusLabelClass}>Verifiziert</span>
                <span className={statusValueClass(verifiedOk)}>
                  {labelVerificationState(profile?.verification_state)}
                </span>
              </div>
              <div className={statusPillClass(topOk)}>
                <span className={statusLabelClass}>Top-Profil</span>
                <span
                  className={
                    allStatusOk || topOk
                      ? "font-semibold text-emerald-700"
                      : "font-semibold text-slate-700"
                  }
                >
                  {topActive ? "aktiv" : "nicht aktiv"}
                </span>
              </div>
            </div>

            {topActive ? (
              <div
                className={
                  allStatusOk
                    ? "text-[11px] text-emerald-800/85"
                    : "text-[11px] text-slate-500"
                }
              >
                Quelle{activeTopSources.length === 1 ? "" : "n"}:{" "}
                <span
                  className={
                    allStatusOk ? "font-medium text-emerald-900" : "text-slate-700"
                  }
                >
                  {topSourcesLabel}
                </span>
              </div>
            ) : profile ? (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-[12px] leading-snug text-amber-950/90">
                <span className="font-semibold">Top-Profil derzeit nicht aktiv.</span> Galerie und Kontaktformular auf
                der öffentlichen Seite erscheinen nur bei aktivem Top-Profil. Für App-Kund:innen wird Top in der Regel
                aus dem <strong>Stripe-Abo</strong> gesetzt (Status aktiv / Testphase / Zahlung ausstehend). Nach dem
                Laden dieser Seite wird das mit deinen Billing-Daten nachgezogen — wenn es hier weiterhin
                „nicht aktiv“ bleibt, prüfe bitte{' '}
                <code className="rounded bg-amber-100/90 px-1 py-0.5 font-mono text-[11px]">
                  STRIPE_PRICE_ID_MONTHLY
                </code>{' '}
                (muss zur Price-ID der App-Subscription passen) und ob Stripe-Webhooks dein Konto erreichen.
              </div>
            ) : null}

            {publicViewContact && profile?.slug ? (
              <div
                className={
                  publicViewContact.contactFormFromView
                    ? "rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-[12px] text-emerald-950/90"
                    : "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700"
                }
              >
                <span className="font-semibold">Öffentliche Verzeichnis-Ansicht</span> (wie Besucher:innen sie sehen)
                {publicViewContact.inPublicDirectory ? (
                  <>
                    : Top-Profil{" "}
                    <span className="font-medium">
                      {publicViewContact.topFromView ? "sichtbar" : "nicht sichtbar"}
                    </span>
                    , Kontaktformular{" "}
                    <span className="font-medium">
                      {publicViewContact.contactFormFromView ? "sichtbar" : "nicht sichtbar"}
                    </span>
                    .{" "}
                    {!publicViewContact.contactFormFromView && publicViewContact.topFromView ? (
                      <span className="block pt-1 text-[11px] text-slate-600">
                        Wenn Top sichtbar ist, das Formular aber nicht: in Schritt 1 unter „Kontakt“ eine gültige
                        E-Mail speichern (wird nicht öffentlich angezeigt, nur für Zustellung der Anfragen).
                      </span>
                    ) : null}
                  </>
                ) : (
                  <div className="space-y-1.5 pt-0.5 text-[11px] leading-snug text-slate-600">
                    <p>
                      Mit Slug <span className="font-mono">/{profile.slug}</span> bist du in der öffentlichen Datenbank{" "}
                      <code className="font-mono text-[10px]">directory_public_profiles</code> noch{" "}
                      <strong>nicht</strong> gelistet — deshalb sehen Besucher:innen weder Profil noch Kontaktformular
                      aus dieser View.
                    </p>
                    {profile.listing_status !== "published" ? (
                      <p className="text-slate-800">
                        <strong>Grund:</strong> Dein Listing-Status ist „
                        {labelListingStatus(profile.listing_status)}“. Öffentlich sichtbar sind nur Einträge mit „
                        <strong>Veröffentlicht</strong>“ (zusätzlich Land DE, AT oder CH). Bei dir ist das Land unkritisch
                        — es fehlt die <strong>Veröffentlichung</strong> des Listings. Mit Admin-Zugang:{" "}
                        <Link href="/admin/directory/profiles" className="font-medium text-[#52b788] hover:underline">
                          Verzeichnis-Profile
                        </Link>{" "}
                        öffnen, deinen Eintrag wählen und auf „Veröffentlicht“ setzen.
                      </p>
                    ) : ["DE", "AT", "CH"].includes(
                        String(profile.country ?? "")
                          .toUpperCase()
                          .trim(),
                      ) ? (
                      <>
                        <p className="text-slate-800">
                          <strong>Unerwartet:</strong> In den Stammdaten stehen „Veröffentlicht“ und ein DACH-Land, aber
                          die öffentliche View liefert für <strong>Anon</strong> (wie die Webseite) keine Zeile.
                        </p>
                        {publicViewContact.devBypass ? (
                          <div className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/90 px-2.5 py-2 text-[11px] text-amber-950/95">
                            {publicViewContact.devBypass.serviceRoleSeesInPublicView ? (
                              <p className="m-0 leading-snug">
                                <strong>Lokal-Check (Service-Role):</strong> Die View enthält deinen Slug — mit dem
                                Anon-Key kommt aber nichts zurück. Sehr häufig: die View läuft mit{" "}
                                <code className="rounded bg-white/80 px-1 font-mono text-[10px]">
                                  security_invoker = true
                                </code>
                                , dann greifen Rechte wie für den Aufrufer und Anon sieht keine Zeilen aus{" "}
                                <code className="font-mono text-[10px]">directory_profiles</code>. Bitte Migration
                                anwenden oder in SQL ausführen:{" "}
                                <code className="mt-1 block whitespace-pre-wrap rounded bg-white/80 p-1.5 font-mono text-[10px]">
                                  ALTER VIEW public.directory_public_profiles SET (security_invoker = false);
                                </code>
                              </p>
                            ) : (
                              <p className="m-0 leading-snug">
                                <strong>Lokal-Check (Service-Role):</strong> In{" "}
                                <code className="font-mono text-[10px]">directory_profiles</code> (ohne RLS): Listing „
                                {publicViewContact.devBypass.baseRow?.listing_status ?? "—"}“, Land „
                                {publicViewContact.devBypass.baseRow?.country ?? "—"}“. Die öffentliche View liefert
                                trotzdem keinen Treffer — dann fehlt meist noch eine{" "}
                                <strong>View-Migration</strong> (Schema-Stand) oder es ist ein{" "}
                                <strong>anderes Supabase-Projekt</strong> als in{" "}
                                <code className="font-mono text-[10px]">.env.local</code>.
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-slate-700">
                            Setze lokal <code className="font-mono text-[10px]">SUPABASE_SERVICE_ROLE_KEY</code>, dann
                            erscheint hier ein Zusatz-Hinweis (Abgleich View vs. Basistabelle).
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-slate-800">
                        <strong>Grund:</strong> Im Profil ist als Land „
                        {String(profile.country ?? "—").toUpperCase()}“ hinterlegt. Die öffentliche View enthält nur DE,
                        AT und CH.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {profile ? (
              <div
                className={
                  allStatusOk
                    ? "text-[11px] font-medium text-emerald-800/90"
                    : "text-[11px] text-slate-500"
                }
              >
                {profile.listing_status === "published"
                  ? "Das Profil ist öffentlich sichtbar."
                  : "Das Profil ist aktuell nicht öffentlich sichtbar (noch nicht veröffentlicht)."}
              </div>
            ) : null}
          </div>
        </div>

        {profile ? (
          <div className="rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">Hinweis:</span> Die öffentliche{' '}
            <strong>Bildergalerie</strong> und das <strong>Kontaktformular</strong> (Anfragen per E-Mail an deine im
            Profil hinterlegte Adresse) sind nur mit <strong>aktivem Top-Profil</strong> sichtbar. Logo, Texte, Links und
            Karte nutzt du weiterhin auch ohne Top-Profil.
          </div>
        ) : null}

        <DirectoryProfileCreateWizard
          embeddedInApp
          specialties={specialties}
          subcategories={subcategories}
          methods={methods}
          animals={animals}
          initialMedia={initialMedia}
          premiumGalleryEnabled={topActive}
          initial={initial}
          submitAction={submitDirectoryProfileWizardForOwnerAction}
          successRedirectTo="/directory/mein-profil?saved=1"
        />
      </div>
    </div>
  );
}
