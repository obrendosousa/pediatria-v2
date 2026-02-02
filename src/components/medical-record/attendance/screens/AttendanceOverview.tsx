import { AttendanceScreenProps } from '@/types/attendance';
import { AttendanceForm } from '../AttendanceForm';

export function AttendanceOverview({ patientId, patientData, onRefresh, appointmentId }: AttendanceScreenProps) {
  return (
    <div className="p-6 pb-24">
      <AttendanceForm
        patientId={patientId}
        appointmentId={appointmentId}
        onSave={onRefresh}
        onFinish={onRefresh}
      />
    </div>
  );
}
