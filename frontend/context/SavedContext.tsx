import { createContext, useContext, useState } from "react";

type SavedContextType = {
    savedCareerIds: number[];
    savedProgrammeIds: number[];
    toggleCareer: (id: number) => void;
    toggleProgramme: (id: number) => void;
    isCareerSaved: (id: number) => boolean;
    isProgrammeSaved: (id: number) => boolean;
};

const SavedContext = createContext<SavedContextType | undefined>(undefined);

export function SavedProvider({ save }: any) {
    const [savedCareerIds, setSavedCareerIds] = useState<number[]>([]);
    const [savedProgrammeIds, setSavedProgrammeIds] = useState<number[]>([]);

    function toggleCareer(id: number) {
        setSavedCareerIds((ids) => ids.includes(id)
            ? ids.filter((item) => item !== id)
            : [...ids, id]
        );
    }

    function toggleProgramme(id: number) {
        setSavedProgrammeIds((ids) => ids.includes(id)
            ? ids.filter((item) => item !== id)
            : [...ids, id]
        );
    }

    function isCareerSaved(id: number) {
        return savedCareerIds.includes(id);
    }

    function isProgrammeSaved(id: number) {
        return savedProgrammeIds.includes(id);
    }

    return (
        <SavedContext.Provider value={{savedCareerIds, savedProgrammeIds, toggleCareer, toggleProgramme, isCareerSaved, isProgrammeSaved}}>{save}</SavedContext.Provider>
    );
}

export function useSaved() {
    const context = useContext(SavedContext);

    if (!context) {
        throw new Error("usedSaved must be used inside SavedProvider");
    }
    return context;
}