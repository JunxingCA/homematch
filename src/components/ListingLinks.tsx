import { ExternalLink } from "lucide-react";
import { listingLinks } from "@/domain/listingLinks";
import type { Preference } from "@/domain/preferences";
import styles from "./ListingLinks.module.css";
export function ListingLinks({
  category,
  areaName,
}: {
  category: Preference["category"];
  areaName: string;
}) {
  return (
    <section className={styles.links} aria-label="External housing listings">
      <h3>Research homes</h3>
      {listingLinks(category, areaName).map((link) => (
        <div key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            {link.label}
            <ExternalLink size={16} />
          </a>
          <p>{link.note}</p>
        </div>
      ))}
      <p>
        {category === "BTO"
          ? "Your saved preferences are not sent to HDB. Select the town on its portal."
          : "Only the area and property type are used in the listing link. Saved destinations are not shared."}
      </p>
    </section>
  );
}
