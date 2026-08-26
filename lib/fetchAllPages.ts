/**
 * Les endpoints de liste (registres, décharges, reçus, motos, documents...)
 * paginent à 20 côté serveur (`paginate(20)` Laravel), mais les écrans
 * affichent un dossier/catégorie entier d'un coup sans scroll infini — sans
 * ça, tout dossier de plus de 20 éléments se voyait silencieusement tronqué
 * à la première page alors que le compteur affiché ailleurs (calculé
 * séparément côté serveur) restait correct. `fetchPage` reçoit le numéro de
 * page (1-indexé) et doit renvoyer la réponse paginée Laravel brute.
 */
export async function fetchAllPages<T = any>(
  fetchPage: (page: number) => Promise<any>,
): Promise<T[]> {
  const first = await fetchPage(1);
  if (!first || !Array.isArray(first.data)) {
    return Array.isArray(first) ? first : [];
  }

  let items: T[] = [...first.data];
  const lastPage = first.last_page ?? 1;
  for (let page = 2; page <= lastPage; page++) {
    const next = await fetchPage(page);
    items = items.concat(next?.data ?? []);
  }
  return items;
}
