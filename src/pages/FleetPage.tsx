import VehiclePerformanceTable from "../components/tables/VehiclePerformanceTable";
import PageHeader from "../components/ui/PageHeader";

export default function FleetPage() {
  return (
    <>
      <PageHeader
        eyebrow="Stammdaten"
        title="Flotte"
        description="Verwalte deine Fahrzeuge, Halter und Stammdaten."
        primaryAction={{ label: "Fahrzeug hinzufügen" }}
      />
      <VehiclePerformanceTable />
    </>
  );
}
