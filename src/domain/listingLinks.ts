import type { Preference } from "./preferences";
export type ListingLink = { label: string; href: string; note: string };
export function listingLinks(
  category: Preference["category"],
  areaName: string,
): ListingLink[] {
  const area = areaName.trim().slice(0, 100);
  if (category === "BTO")
    return [
      {
        label: "View official BTO projects",
        href: "https://homes.hdb.gov.sg/home/finding-a-flat",
        note: `Select ${area} and BTO on the HDB portal. Project availability and prices are not checked by HomeMatch.`,
      },
    ];
  const url = new URL("https://www.propertyguru.com.sg/property-for-sale");
  url.search = new URLSearchParams({
    listingType: "sale",
    isCommercial: "false",
    keyword: area,
    propertyTypeGroup:
      category === "Resale HDB" ? "H" : category === "Condominium" ? "N" : "L",
  }).toString();
  const noun =
    category === "Resale HDB"
      ? "HDB flats"
      : category === "Condominium"
        ? "apartments and condos"
        : "landed homes";
  const links = [
    {
      label: `Search ${area} ${noun} on PropertyGuru`,
      href: url.toString(),
      note: "Area keyword search, not a town-boundary filter. Check location, availability and asking prices on the listing site.",
    },
  ];
  if (category === "Resale HDB")
    links.push({
      label: "Browse official HDB resale listings",
      href: "https://homes.hdb.gov.sg/home/finding-a-flat",
      note: `Select ${area} and resale on the HDB portal. HomeMatch does not transfer its town filter automatically.`,
    });
  return links;
}
