import Link from "next/link";

export type CourseConceptNavigationItem = {
  id: string;
  title: string;
  material_id: string;
  ordinal: number;
};

export function orderConceptsByMaterial<T extends CourseConceptNavigationItem>(
  materials: readonly { id: string }[],
  concepts: readonly T[],
): T[] {
  const conceptsByMaterial = new Map<string, T[]>();
  for (const concept of concepts) {
    conceptsByMaterial.set(concept.material_id, [
      ...(conceptsByMaterial.get(concept.material_id) ?? []),
      concept,
    ]);
  }
  return materials.flatMap((material) => (conceptsByMaterial.get(material.id) ?? [])
    .sort((left, right) => left.ordinal - right.ordinal || left.id.localeCompare(right.id)));
}

type Props = {
  courseId: string;
  concepts: readonly CourseConceptNavigationItem[];
  currentConceptId: string;
};

export function CourseConceptSelector({ courseId, concepts, currentConceptId }: Props) {
  return <details className="course-concept-sidebar" open>
    <summary><span>Course concepts</span><span className="course-concept-count">{concepts.length}</span></summary>
    <nav aria-label="Course concepts">
      <ul className="course-concept-selector-list">
        {concepts.map((concept) => <li key={concept.id}>
          {concept.id === currentConceptId
            ? <span className="course-concept-selector-item is-current" aria-current="page">{concept.title}</span>
            : <Link className="course-concept-selector-item" href={`/courses/${courseId}?conceptId=${encodeURIComponent(concept.id)}`}>{concept.title}</Link>}
        </li>)}
      </ul>
    </nav>
  </details>;
}
