import { useState } from "react";
import clsx from "clsx";
import { CLUB_GROUPS, clubGroupLabel, clubLabel } from "../data/clubs";
import { useLanguage } from "../data/i18n";
import type { Club } from "../data/schema";

type ClubSelectorProps = {
  selectedClub: Club;
  onChange: (club: Club) => void;
};

function groupForClub(club: Club) {
  return CLUB_GROUPS.find((group) => group.clubs.includes(club))?.id ?? CLUB_GROUPS[0].id;
}

export function ClubSelector({ selectedClub, onChange }: ClubSelectorProps) {
  const { language } = useLanguage();
  const [openGroup, setOpenGroup] = useState(() => groupForClub(selectedClub));
  const currentGroup = CLUB_GROUPS.find((group) => group.id === openGroup) ?? CLUB_GROUPS[0];

  return (
    <div className="club-selector" aria-label="Club selector">
      <div className="club-group-row">
        {CLUB_GROUPS.map((group) => {
          const isOpen = group.id === openGroup;
          const hasSelected = group.clubs.includes(selectedClub);
          return (
            <button
              aria-expanded={isOpen}
              className={clsx("club-group-button", isOpen && "open", hasSelected && "selected")}
              key={group.id}
              onClick={() => setOpenGroup(group.id)}
              type="button"
            >
              {clubGroupLabel(group, language)}
            </button>
          );
        })}
      </div>
      <div className="club-filter-row club-choice-row">
        {currentGroup.clubs.map((club) => (
          <button className={club === selectedClub ? "chip chip-accent active" : "chip"} key={club} onClick={() => onChange(club)} type="button">
            {clubLabel(club, language)}
          </button>
        ))}
      </div>
    </div>
  );
}
