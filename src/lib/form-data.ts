/** Reads a text field from a form. Missing fields and file inputs read as "". */
export function textField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
