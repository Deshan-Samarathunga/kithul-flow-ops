import { Badge } from "@/components/ui/badge";

type StatusType = "in-progress" | "completed";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

const statusConfig = {
  "in-progress": {
    label: "In progress",
    className: "bg-status-progressBg text-status-progress border-status-progress/20",
  },
  completed: {
    label: "Completed",
    className: "bg-status-completedBg text-status-completed border-status-completed/20",
  },
};

export const StatusBadge = ({ status, label }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={`${config.className} font-medium`}>
      {label || config.label}
    </Badge>
  );
};
