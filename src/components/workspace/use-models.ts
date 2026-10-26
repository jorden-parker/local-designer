import { useEffect, useState } from "react";
import { fetchModels } from "@/components/api";

export function useModels(savedModel: string | null) {
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState<string | null>(savedModel);

  useEffect(() => {
    let current = true;
    fetchModels()
      .then((list) => {
        if (!current) return;
        setModels(list.models);
        setModel((chosen) => chosen ?? list.defaultModel);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  const choices = model && !models.includes(model) ? [model, ...models] : models;
  return { models: choices, model, setModel };
}
