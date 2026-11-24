export function getSortIcon(column: string, activeColumn: string, direction: string): string {
  if (column !== activeColumn) return "";
  return direction === "asc" ? "↑" : "↓";
}

export function getStripedRowClasses(index: number, isExportMode: boolean): string {
  const zebraClasses =
    index % 2 === 1
      ? "bg-gray-100 dark:bg-gray-800/70"
      : "bg-white dark:bg-gray-900";

  if (isExportMode) {
    return zebraClasses;
  }

  const hoverClasses =
    index % 2 === 1
      ? "hover:bg-gray-200 dark:hover:bg-gray-700"
      : "hover:bg-gray-50 dark:hover:bg-gray-800";

  return `${zebraClasses} ${hoverClasses}`;
}
