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
import { syncAppTopEntitlementFromBilling } from "@/lib/directory/syncAppTopEntitlement.server";
import { DirectoryMeinProfilStatusCard } from "@/components/directory/intern/DirectoryMeinProfilStatusCard";

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

  const wizardPaketRaw =
    (Array.isArray(sp.paket) ? sp.paket[0] : sp.paket)?.toString().trim().toLowerCase() ?? "";
  const wizardPaket: "gratis" | "premium" =
    wizardPaketRaw === "premium" ? "premium" : "gratis";
  const premiumSubRaw =
    (Array.isArray(sp.premium_sub) ? sp.premium_sub[0] : sp.premium_sub)?.toString().trim() ?? "";
  const wizardResumePremiumSub =
    premiumSubRaw === "success"
      ? ("success" as const)
      : premiumSubRaw === "canceled"
        ? ("canceled" as const)
        : null;
  const directoryOnboardingProductFromQuery =
    wizardPaket === "premium" ? ("directory_premium" as const) : ("free" as const);

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
        <div className="directory-success-callout px-4 py-3 text-[13px]">
          <div className="flex items-start gap-2">
            <i
              className="bi bi-check-circle-fill mt-[2px] shrink-0 text-[#00bc7d]"
              aria-hidden
            />
            <div className="min-w-0">
              <div className="directory-success-callout__title">Profil gespeichert</div>
              <div className="directory-success-callout__body mt-0.5 text-[13px] leading-snug">
                Deine Änderungen wurden übernommen. Du kannst jetzt weiter
                bearbeiten oder die Vorschau prüfen.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-7">
        <DirectoryMeinProfilStatusCard
          hasProfile={Boolean(profile)}
          displayName={profile?.display_name}
          slug={profile?.slug}
          listingStatus={profile?.listing_status}
          verificationState={profile?.verification_state}
          topActive={topActive}
          topSourcesLabel={topSourcesLabel}
        />

        <div id="dir-profile-wizard" className="scroll-mt-6">
        <DirectoryProfileCreateWizard
          embeddedInApp
          specialties={specialties}
          subcategories={subcategories}
          methods={methods}
          animals={animals}
          initialMedia={initialMedia}
          premiumGalleryEnabled={topActive}
          directoryOnboardingProduct={directoryOnboardingProductFromQuery}
          publicPaket={wizardPaket}
          wizardResumeProfileId={profileId}
          wizardResumePremiumSub={wizardResumePremiumSub}
          initial={initial}
          submitAction={submitDirectoryProfileWizardForOwnerAction}
          successRedirectTo="/directory/mein-profil?saved=1"
        />
        </div>
      </div>
    </div>
  );
}
