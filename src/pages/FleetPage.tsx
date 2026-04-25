import VehiclePerformanceTable from "../components/tables/VehiclePerformanceTable";
import PageHeader from "../components/ui/PageHeader";

export default function FleetPage() {
  return (
    <>
      <PageHeader
        title="Flotte"
        description="Verwalte deine Fahrzeuge, Halter und Stammdaten."
      />
      <VehiclePerformanceTable />
    </>
  );
}
