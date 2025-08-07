import { z, ZodIssue } from "zod";
import * as vscode from "vscode";


// This schema is used to ensure that the dlconfig.json file conforms to the expected structure and types.
export const dlConfigSchema = z.object({
  experimentRoot: z.string().nonempty(),
  // Add other fields as necessary based on the expected structure of dlconfig.json
}).superRefine(async (data, ctx) => {
    try {
        const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, data.experimentRoot);
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.type !== vscode.FileType.Directory) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["experimentRoot"],
                message: `experimentRoot must be a directory, but found a file: ${data.experimentRoot}`,
            });
        }
    } catch (error) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["experimentRoot"],
            message: `experimentRoot directory does not exist in workspace: ${data.experimentRoot}`,
        });
    }
});


export type DlConfigType = z.infer<typeof dlConfigSchema>;